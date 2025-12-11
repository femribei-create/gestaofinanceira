import { eq, and, gte, desc } from "drizzle-orm";
import { getDb } from "./db";
import { classificationRules, classificationHistory, categories } from "../drizzle/schema";

export type TransactionType = "income" | "expense";
export type MatchType = "contains" | "starts_with" | "ends_with" | "exact";

export interface CategorizationResult {
  categoryId: number;
  categoryName: string;
  transactionType: TransactionType;
  confidence: number;
  method: "rule" | "history" | "ai";
}

// ============================================================================
// 1. NORMALIZAÇÃO DE SINAIS POR ARQUIVO
// ============================================================================

export function normalizarSinal(
  valor: number,
  fileSource: "itau" | "nubank_pj" | "nubank_pessoal" | "inter" | "sangria" | "cartao_master" | "cartao_visa"
): { valor: number; tipo: TransactionType } {
  // Grupo 1: Sinal natural (Itaú, Nubank, Inter)
  if (["itau", "nubank_pj", "nubank_pessoal", "inter"].includes(fileSource)) {
    return {
      valor: valor,
      tipo: valor >= 0 ? "income" : "expense",
    };
  }

  // Grupo 2: Sangria (sempre despesa)
  if (fileSource === "sangria") {
    return {
      valor: Math.abs(valor) * -1,
      tipo: "expense",
    };
  }

  // Grupo 3: Cartões (sinal invertido)
  if (["cartao_master", "cartao_visa"].includes(fileSource)) {
    return {
      valor: valor * -1,
      tipo: valor >= 0 ? "expense" : "income",
    };
  }

  throw new Error(`Arquivo desconhecido: ${fileSource}`);
}

// ============================================================================
// 2. BUSCAR REGRA CORRESPONDENTE
// ============================================================================

async function findMatchingRule(
  userId: number,
  description: string,
  accountId?: number
): Promise<{
  categoryId: number;
  categoryName: string;
  transactionType: TransactionType;
} | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar regras ativas do usuário, ordenadas por prioridade
  const rules = await db
    .select({
      id: classificationRules.id,
      pattern: classificationRules.pattern,
      matchType: classificationRules.matchType,
      categoryId: classificationRules.categoryId,
      transactionType: classificationRules.transactionType,
      categoryName: categories.name,
    })
    .from(classificationRules)
    .leftJoin(categories, eq(classificationRules.categoryId, categories.id))
    .where(
      and(
        eq(classificationRules.userId, userId),
        eq(classificationRules.isActive, true)
      )
    )
    .orderBy(desc(classificationRules.priority));

  const descriptionLower = description.toLowerCase();

  // Procurar por correspondência
  for (const rule of rules) {
    const patternLower = rule.pattern.toLowerCase();

    let matches = false;
    switch (rule.matchType) {
      case "contains":
        matches = descriptionLower.includes(patternLower);
        break;
      case "starts_with":
        matches = descriptionLower.startsWith(patternLower);
        break;
      case "ends_with":
        matches = descriptionLower.endsWith(patternLower);
        break;
      case "exact":
        matches = descriptionLower === patternLower;
        break;
    }

    if (matches) {
      return {
        categoryId: rule.categoryId,
        categoryName: rule.categoryName || "",
        transactionType: rule.transactionType,
      };
    }
  }

  return null;
}

// ============================================================================
// 3. BUSCAR PADRÃO APRENDIDO (HISTÓRICO)
// ============================================================================

async function findHistoryPattern(
  userId: number,
  description: string
): Promise<{
  categoryId: number;
  categoryName: string;
  confidence: number;
} | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar padrões com alta frequência
  const patterns = await db
    .select({
      categoryId: classificationHistory.categoryId,
      categoryName: categories.name,
      count: classificationHistory.count,
    })
    .from(classificationHistory)
    .leftJoin(categories, eq(classificationHistory.categoryId, categories.id))
    .where(
      and(
        eq(classificationHistory.userId, userId),
        eq(classificationHistory.description, description)
      )
    )
    .orderBy(desc(classificationHistory.count))
    .limit(1);

  if (patterns.length > 0) {
    const pattern = patterns[0];
    // Confiança baseada na frequência: cada ocorrência = +10% até máximo 90%
    const confidence = Math.min(0.5 + pattern.count * 0.1, 0.9);

    // Atualizar lastUsed
    await db
      .update(classificationHistory)
      .set({ lastUsed: new Date() })
      .where(
        and(
          eq(classificationHistory.userId, userId),
          eq(classificationHistory.description, description),
          eq(classificationHistory.categoryId, pattern.categoryId)
        )
      );

    return {
      categoryId: pattern.categoryId,
      categoryName: pattern.categoryName || "",
      confidence,
    };
  }

  return null;
}

// ============================================================================
// 4. CHAMAR IA PARA SUGERIR CATEGORIA
// ============================================================================

async function callAI(
  description: string,
  amount: number,
  allCategories: Array<{ id: number; name: string }>
): Promise<{ categoryId: number; categoryName: string; confidence: number }> {
  try {
    const categoryList = allCategories.map((c) => c.name).join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-mini",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de categorização financeira. Dado uma descrição de transação, você deve sugerir a categoria mais apropriada.

Categorias disponíveis:
${categoryList}

Responda APENAS com um JSON no formato:
{"categoryName": "NOME_DA_CATEGORIA", "confidence": 0.95}

Onde confidence é um número entre 0 e 1 (0.95 = 95% confiança).`,
          },
          {
            role: "user",
            content: `Descrição: "${description}"
Valor: R$ ${(Math.abs(amount) / 100).toFixed(2)}

Qual é a categoria mais apropriada?`,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
    });

    const data = (await response.json()) as any;

    if (!data.choices || !data.choices[0]) {
      throw new Error("Resposta vazia da IA");
    }

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Encontrar o ID da categoria pelo nome
    const category = allCategories.find(
      (c) => c.name.toLowerCase() === parsed.categoryName.toLowerCase()
    );

    if (!category) {
      throw new Error(`Categoria não encontrada: ${parsed.categoryName}`);
    }

    return {
      categoryId: category.id,
      categoryName: category.name,
      confidence: Math.min(parsed.confidence, 0.99), // Máximo 99% para IA
    };
  } catch (error) {
    console.error("[Categorization] Erro ao chamar IA:", error);
    // Retornar erro para que o usuário categorize manualmente
    throw error;
  }
}

// ============================================================================
// 5. FUNÇÃO PRINCIPAL DE CATEGORIZAÇÃO
// ============================================================================

export async function categorizeTransaction(
  userId: number,
  description: string,
  amount: number,
  accountId?: number
): Promise<CategorizationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar todas as categorias do usuário
  const userCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId));

  // Passo 1: Verificar regras
  const rule = await findMatchingRule(userId, description, accountId);
  if (rule) {
    return {
      categoryId: rule.categoryId,
      categoryName: rule.categoryName,
      transactionType: rule.transactionType,
      confidence: 1.0,
      method: "rule",
    };
  }

  // Passo 2: Verificar histórico
  const history = await findHistoryPattern(userId, description);
  if (history && history.confidence >= 0.7) {
    return {
      categoryId: history.categoryId,
      categoryName: history.categoryName,
      transactionType: amount >= 0 ? "income" : "expense",
      confidence: history.confidence,
      method: "history",
    };
  }

  // Passo 3: Chamar IA
  const aiSuggestion = await callAI(description, amount, userCategories);

  return {
    categoryId: aiSuggestion.categoryId,
    categoryName: aiSuggestion.categoryName,
    transactionType: amount >= 0 ? "income" : "expense",
    confidence: aiSuggestion.confidence,
    method: "ai",
  };
}

// ============================================================================
// 6. APRENDER COM CORREÇÃO DO USUÁRIO
// ============================================================================

export async function learnFromCorrection(
  userId: number,
  description: string,
  categoryId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar padrão existente
  const existing = await db
    .select()
    .from(classificationHistory)
    .where(
      and(
        eq(classificationHistory.userId, userId),
        eq(classificationHistory.description, description),
        eq(classificationHistory.categoryId, categoryId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Incrementar contador
    await db
      .update(classificationHistory)
      .set({
        count: existing[0].count + 1,
        lastUsed: new Date(),
      })
      .where(
        and(
          eq(classificationHistory.userId, userId),
          eq(classificationHistory.description, description),
          eq(classificationHistory.categoryId, categoryId)
        )
      );
  } else {
    // Criar novo padrão
    await db.insert(classificationHistory).values({
      userId,
      description,
      categoryId,
      count: 1,
      lastUsed: new Date(),
      createdAt: new Date(),
    });
  }
}

// ============================================================================
// 7. LISTAR REGRAS DO USUÁRIO
// ============================================================================

export async function getUserRules(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select({
      id: classificationRules.id,
      pattern: classificationRules.pattern,
      matchType: classificationRules.matchType,
      categoryId: classificationRules.categoryId,
      categoryName: categories.name,
      transactionType: classificationRules.transactionType,
      priority: classificationRules.priority,
      isActive: classificationRules.isActive,
    })
    .from(classificationRules)
    .leftJoin(categories, eq(classificationRules.categoryId, categories.id))
    .where(eq(classificationRules.userId, userId))
    .orderBy(desc(classificationRules.priority));
}

// ============================================================================
// 8. LISTAR HISTÓRICO DE APRENDIZADO
// ============================================================================

export async function getUserLearningHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select({
      id: classificationHistory.id,
      description: classificationHistory.description,
      categoryId: classificationHistory.categoryId,
      categoryName: categories.name,
      count: classificationHistory.count,
      lastUsed: classificationHistory.lastUsed,
      createdAt: classificationHistory.createdAt,
    })
    .from(classificationHistory)
    .leftJoin(categories, eq(classificationHistory.categoryId, categories.id))
    .where(eq(classificationHistory.userId, userId))
    .orderBy(desc(classificationHistory.count));
}

// ============================================================================
// 9. CRIAR/ATUALIZAR REGRA
// ============================================================================

export async function createOrUpdateRule(
  userId: number,
  ruleId: number | null,
  pattern: string,
  matchType: MatchType,
  categoryId: number,
  transactionType: TransactionType,
  priority: number = 0
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (ruleId) {
    // Atualizar
    await db
      .update(classificationRules)
      .set({
        pattern,
        matchType,
        categoryId,
        transactionType,
        priority,
      })
      .where(eq(classificationRules.id, ruleId));
  } else {
    // Criar
    await db.insert(classificationRules).values({
      userId,
      pattern,
      matchType,
      categoryId,
      transactionType,
      priority,
      isActive: true,
      createdAt: new Date(),
    });
  }
}

// ============================================================================
// 10. DELETAR REGRA
// ============================================================================

export async function deleteRule(ruleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(classificationRules)
    .set({ isActive: false })
    .where(eq(classificationRules.id, ruleId));
}

// ============================================================================
// 11. DELETAR PADRÃO APRENDIDO
// ============================================================================

export async function deleteHistoryPattern(patternId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(classificationHistory)
    .where(eq(classificationHistory.id, patternId));
}
