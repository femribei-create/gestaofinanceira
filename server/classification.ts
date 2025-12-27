/**
 * Classificação automática de transações
 * Usa regras definidas pelo usuário + histórico + IA
 */

import type { Category, ClassificationRule } from "../drizzle/schema";
import type { ParsedTransaction } from "./parsers";
import { getClassificationHistory } from "./db";
import { invokeLLM } from "./_core/llm";

export interface ClassificationResult {
  categoryId: number | null;
  method: "rule" | "ai" | "history" | "manual";
  confidence: number;
  suggestedCategoryId?: number;
}

/**
 * Normaliza texto removendo acentos e caixa alta
 */
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Aplica regras de classificação com suporte a múltiplos padrões e filtros de valor
 */
export async function applyRules(
  description: string,
  amount: number,
  accountId: number,
  rules: ClassificationRule[]
): Promise<ClassificationResult | null> {
  const normalizedDesc = normalizeText(description);
  const absAmount = Math.abs(amount);
  
  for (const rule of rules) {
    if (rule.accountId && rule.accountId !== accountId) continue;
    
    const patterns = rule.pattern.split(';').map(p => normalizeText(p)).filter(p => p.length > 0);
    let matches = false;

    for (const pattern of patterns) {
      switch (rule.matchType) {
        case "contains":
          if (normalizedDesc.includes(pattern)) matches = true;
          break;
        case "starts_with":
          if (normalizedDesc.startsWith(pattern)) matches = true;
          break;
        case "ends_with":
          if (normalizedDesc.endsWith(pattern)) matches = true;
          break;
        case "exact":
          if (normalizedDesc === pattern) matches = true;
          break;
      }
      if (matches) break;
    }
    
    if (!matches) continue;

    // Validar filtros de valor
    if (rule.minAmount !== null && rule.minAmount !== undefined) {
      if (absAmount < rule.minAmount) continue;
    }
    if (rule.maxAmount !== null && rule.maxAmount !== undefined) {
      if (absAmount > rule.maxAmount) continue;
    }
    
    return {
      categoryId: rule.categoryId,
      method: "rule",
      confidence: 100,
    };
  }
  
  return null;
}

/**
 * Classifica baseado no histórico de aprendizado
 */
export async function classifyByHistory(
  userId: number,
  description: string
): Promise<ClassificationResult | null> {
  const history = await getClassificationHistory(userId, description);
  
  if (history.length === 0) {
    return null;
  }
  
  const best = history[0]!;
  const totalCount = history.reduce((sum, h) => sum + h.count, 0);
  const confidence = Math.round((best.count / totalCount) * 100);
  
  return {
    categoryId: best.categoryId,
    method: "history",
    confidence,
  };
}

/**
 * Classifica usando IA (GPT-4)
 * Reabilitado para melhor precisão em transações novas
 */
export async function classifyByAI(
  description: string,
  categories: Category[]
): Promise<ClassificationResult | null> {
  try {
    const categoryList = categories.map(c => {
      if (c.subcategory) {
        return `${c.name} > ${c.subcategory}`;
      }
      return c.name;
    }).join('\n');
    
    const prompt = `Você é um assistente financeiro que classifica transações bancárias.

Dada a seguinte descrição de transação:
"${description}"

Escolha a categoria mais apropriada da lista abaixo:
${categoryList}

Responda APENAS com o nome exato da categoria, sem explicações adicionais.`;
    
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um assistente financeiro especializado em classificação de transações." },
        { role: "user", content: prompt },
      ],
    });
    
    const content = response.choices[0]?.message.content;
    const suggestedCategory = typeof content === 'string' ? content.trim() : null;
    
    if (!suggestedCategory) {
      return null;
    }
    
    const matchedCategory = categories.find(c => {
      const fullName = c.subcategory ? `${c.name} > ${c.subcategory}` : c.name;
      return normalizeText(fullName) === normalizeText(suggestedCategory);
    });
    
    if (matchedCategory) {
      return {
        categoryId: matchedCategory.id,
        method: "ai",
        confidence: 80,
      };
    }
    
    return null;
  } catch (error) {
    console.error("[Classification] AI classification failed:", error);
    return null;
  }
}

/**
 * Classifica uma transação usando a cadeia de classificação:
 * 1. Regras (100% confiança)
 * 2. Histórico (se confiança >= 70%)
 * 3. IA (para casos novos)
 * 4. Manual (se nenhum método funcionar)
 */
export async function classifyTransaction(
  userId: number,
  transaction: ParsedTransaction,
  accountId: number,
  rules: ClassificationRule[],
  categories: Category[]
): Promise<ClassificationResult> {
  // Passo 1: Tentar regras
  const ruleResult = await applyRules(transaction.description, transaction.amount, accountId, rules);
  if (ruleResult) {
    return ruleResult;
  }
  
  // Passo 2: Tentar histórico
  const historyResult = await classifyByHistory(userId, transaction.description);
  if (historyResult && historyResult.confidence >= 70) {
    return historyResult;
  }
  
  // Passo 3: Tentar IA
  const aiResult = await classifyByAI(transaction.description, categories);
  if (aiResult && aiResult.categoryId) {
    return aiResult;
  }
  
  // Passo 4: Se houver histórico com confiança baixa, sugerir
  if (historyResult) {
    return {
      categoryId: null,
      method: "manual",
      confidence: 0,
      suggestedCategoryId: historyResult.categoryId ?? undefined,
    };
  }
  
  // Passo 5: Sem classificação possível
  return {
    categoryId: null,
    method: "manual",
    confidence: 0,
  };
}

/**
 * Classifica um lote de transações
 */
export async function classifyTransactionsBatch(
  userId: number,
  transactions: ParsedTransaction[],
  accountId: number,
  rules: ClassificationRule[],
  categories: Category[]
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];
  
  for (const transaction of transactions) {
    const result = await classifyTransaction(
      userId,
      transaction,
      accountId,
      rules,
      categories
    );
    results.push(result);
  }
  
  return results;
}

/**
 * Retorna regras padrão (vazio pois o usuário cria as regras)
 */
export function getDefaultRules(userId: number, categories: Map<string, number>): any[] {
  return [];
}
