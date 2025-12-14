// ... imports (mantenha os mesmos) ...
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

export async function applyRules(
  description: string,
  amount: number,
  accountId: number,
  rules: ClassificationRule[]
): Promise<ClassificationResult | null> {
  const normalizedDesc = description.toLowerCase().trim();
  const absAmount = Math.abs(amount);
  
  for (const rule of rules) {
    if (rule.accountId && rule.accountId !== accountId) continue;
    
    // --- LÓGICA DE MULTIPLOS TERMOS (Separados por ;) ---
    const patterns = rule.pattern.toLowerCase().split(';').map(p => p.trim()).filter(p => p.length > 0);
    let matches = false;

    // Se qualquer um dos padrões bater, matches vira true
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
      if (matches) break; // Se já achou um match, para de procurar nos outros termos
    }
    
    if (!matches) continue;

    // --- LÓGICA DE VALOR ---
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

// ... Mantenha o restante do arquivo (classifyByHistory, classifyByAI, classifyTransaction) igualzinho estava ...
export async function classifyByHistory(userId: number, description: string): Promise<ClassificationResult | null> {
  const history = await getClassificationHistory(userId, description);
  if (history.length === 0) return null;
  const best = history[0]!;
  const totalCount = history.reduce((sum, h) => sum + h.count, 0);
  const confidence = Math.round((best.count / totalCount) * 100);
  return { categoryId: best.categoryId, method: "history", confidence };
}

export async function classifyByAI(description: string, categories: Category[]): Promise<ClassificationResult | null> {
    // ... manter lógica original ...
    return null;
}

export async function classifyTransaction(
  userId: number,
  transaction: ParsedTransaction,
  accountId: number,
  rules: ClassificationRule[],
  categories: Category[]
): Promise<ClassificationResult> {
  const ruleResult = await applyRules(transaction.description, transaction.amount, accountId, rules);
  if (ruleResult) return ruleResult;
  
  const historyResult = await classifyByHistory(userId, transaction.description);
  if (historyResult && historyResult.confidence >= 70) return historyResult;
  
  if (historyResult) {
    return { categoryId: null, method: "manual", confidence: 0, suggestedCategoryId: historyResult.categoryId ?? undefined };
  }
  
  return { categoryId: null, method: "manual", confidence: 0 };
}

export async function classifyTransactionsBatch(
    userId: number,
    transactions: ParsedTransaction[],
    accountId: number,
    rules: ClassificationRule[],
    categories: Category[]
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    for (const transaction of transactions) {
      const result = await classifyTransaction(userId, transaction, accountId, rules, categories);
      results.push(result);
    }
    return results;
  }

export function getDefaultRules(userId: number, categories: Map<string, number>) {
    return [];
}
