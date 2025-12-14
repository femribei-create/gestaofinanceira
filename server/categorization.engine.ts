import { getDb } from "./db";
import { classificationRules, classificationHistory, transactions, categories, accounts } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
// CORREÇÃO AQUI: Mudamos de ".." para "." pois estão na mesma pasta
import { applyRules, classifyTransaction } from "./classification"; 

/**
 * Motor de Categorização
 * Gerencia a lógica de banco de dados para regras e aprendizado
 */

// 1. Criar ou Atualizar Regra
export async function createOrUpdateRule(
  userId: number,
  ruleId: number | null,
  pattern: string,
  matchType: "contains" | "starts_with" | "ends_with" | "exact",
  categoryId: number,
  transactionType: "income" | "expense",
  priority: number,
  minAmount?: number, // Novo campo
  maxAmount?: number  // Novo campo
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Prepara os dados para salvar
  const data = {
    userId,
    pattern,
    matchType,
    categoryId,
    transactionType,
    priority,
    // Garante que se for undefined vira null (para o banco aceitar)
    minAmount: minAmount || null, 
    maxAmount: maxAmount || null,
    isActive: true,
  };

  if (ruleId) {
    // Atualizar existente
    await db
      .update(classificationRules)
      .set(data)
      .where(and(eq(classificationRules.id, ruleId), eq(classificationRules.userId, userId)));
  } else {
    // Criar nova
    await db.insert(classificationRules).values(data);
  }
}

// 2. Deletar Regra
export async function deleteRule(ruleId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(classificationRules).where(eq(classificationRules.id, ruleId));
}

// 3. Listar Regras (Para aparecer na tela)
export async function getUserRules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const rules = await db
    .select({
      id: classificationRules.id,
      pattern: classificationRules.pattern,
      matchType: classificationRules.matchType,
      categoryId: classificationRules.categoryId,
      categoryName: categories.name,
      subcategoryName: categories.subcategory,
      transactionType: classificationRules.transactionType,
      priority: classificationRules.priority,
      // Importante: Trazer os valores do banco
      minAmount: classificationRules.minAmount,
      maxAmount: classificationRules.maxAmount,
    })
    .from(classificationRules)
    .leftJoin(categories, eq(classificationRules.categoryId, categories.id))
    .where(eq(classificationRules.userId, userId))
    .orderBy(desc(classificationRules.priority));
    
  return rules;
}

// 4. Funções de Histórico e Aprendizado
export async function deleteHistoryPattern(patternId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(classificationHistory).where(eq(classificationHistory.id, patternId));
}

export async function getUserLearningHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const history = await db
    .select({
      id: classificationHistory.id,
      description: classificationHistory.description,
      categoryId: classificationHistory.categoryId,
      categoryName: categories.name,
      count: classificationHistory.count,
      lastUsed: classificationHistory.lastUsed,
    })
    .from(classificationHistory)
    .leftJoin(categories, eq(classificationHistory.categoryId, categories.id))
    .where(eq(classificationHistory.userId, userId))
    .orderBy(desc(classificationHistory.lastUsed));

  return history;
}

// 5. Helpers
export function normalizarSinal(amount: number, fileSource: string): number {
  return amount;
}

export async function categorizeTransaction(userId: number, description: string, amount: number, accountId?: number) {
    const db = await getDb();
    if (!db) throw new Error("DB Error");

    // Busca as regras já formatadas
    const userRules = await getUserRules(userId);
    
    // Busca categorias para IA
    const allCategories = await db.select().from(categories).where(eq(categories.userId, userId));

    // Chama a função de classificação passando o amount
    // Usamos 'as any' para contornar checagens estritas de tipo do objeto Date, focando na lógica
    return await classifyTransaction(
        userId, 
        { description, amount, date: new Date() } as any, 
        accountId || 0, 
        userRules as any, 
        allCategories
    );
}

export async function learnFromCorrection(userId: number, description: string, categoryId: number) {
    const db = await getDb();
    if(!db) return;
    
    const existing = await db.select().from(classificationHistory)
        .where(and(
            eq(classificationHistory.userId, userId),
            eq(classificationHistory.description, description),
            eq(classificationHistory.categoryId, categoryId)
        ));

    if(existing.length > 0) {
        await db.update(classificationHistory)
            .set({ 
                count: existing[0].count + 1,
                lastUsed: new Date()
            })
            .where(eq(classificationHistory.id, existing[0].id));
    } else {
        await db.insert(classificationHistory).values({
            userId,
            description,
            categoryId,
            count: 1
        });
    }
}
