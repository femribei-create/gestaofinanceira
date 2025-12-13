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
  confidence: number; // 0-100
  suggestedCategoryId?: number;
}

/**
 * Aplica regras de classificação
 * Retorna a primeira regra que fizer match
 */
export async function applyRules(
  description: string,
  amount: number,
  accountId: number,
  rules: ClassificationRule[]
): Promise<ClassificationResult | null> {
  const normalizedDesc = description.toLowerCase().trim();
  const absAmount = Math.abs(amount); // Trabalhar com valor absoluto (ignora sinal negativo de despesa)
  
  for (const rule of rules) {
    // Verificar se a regra é específica para uma conta
    if (rule.accountId && rule.accountId !== accountId) {
      continue;
    }
    
    // VERIFICAÇÃO DE TEXTO
    const pattern = rule.pattern.toLowerCase().trim();
    let matches = false;
    
    switch (rule.matchType) {
      case "contains":
        matches = normalizedDesc.includes(pattern);
        break;
      case "starts_with":
        matches = normalizedDesc.startsWith(pattern);
        break;
      case "ends_with":
        matches = normalizedDesc.endsWith(pattern);
        break;
      case "exact":
        matches = normalizedDesc === pattern;
        break;
    }
    
    // Se o texto não bater, pula para a próxima regra
    if (!matches) {
      continue;
    }

    // VERIFICAÇÃO DE VALOR (Nova funcionalidade)
    // Se a regra tiver valor mínimo e o valor da transação for menor, pula
    if (rule.minAmount !== null && rule.minAmount !== undefined) {
      if (absAmount < rule.minAmount) {
        continue;
      }
    }

    // Se a regra tiver valor máximo e o valor da transação for maior, pula
    if (rule.maxAmount !== null && rule.maxAmount !== undefined) {
      if (absAmount > rule.maxAmount) {
        continue;
      }
    }
    
    // Se chegou aqui, bateu texto E valor (se houver restrição de valor)
    return {
      categoryId: rule.categoryId,
      method: "rule",
      confidence: 100, // Regras têm 100% de confiança
    };
  }
  
  return null;
}

/**
 * Classifica usando histórico de classificações anteriores
 * Busca por descrições similares e retorna a categoria mais usada
 */
export async function classifyByHistory(
  userId: number,
  description: string
): Promise<ClassificationResult | null> {
  const history = await getClassificationHistory(userId, description);
  
  if (history.length === 0) {
    return null;
  }
  
  // Pegar a categoria mais usada
  const best = history[0]!;
  
  // Calcular confiança baseada na frequência
  const totalCount = history.reduce((sum, h) => sum + h.count, 0);
  const confidence = Math.round((best.count / totalCount) * 100);
  
  return {
    categoryId: best.categoryId,
    method: "history",
    confidence,
  };
}

/**
 * Classifica usando IA
 * Envia a descrição para o LLM e pede para sugerir uma categoria
 */
export async function classifyByAI(
  description: string,
  categories: Category[]
): Promise<ClassificationResult | null> {
  try {
    // Preparar lista de categorias para o LLM
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
    
    // Encontrar a categoria correspondente
    const matchedCategory = categories.find(c => {
      const fullName = c.subcategory ? `${c.name} > ${c.subcategory}` : c.name;
      return fullName.toLowerCase() === suggestedCategory.toLowerCase();
    });
    
    if (matchedCategory) {
      return {
        categoryId: matchedCategory.id,
        method: "ai",
        confidence: 80, // IA tem 80% de confiança por padrão
      };
    }
    
    return null;
  } catch (error) {
    console.error("[Classification] AI classification failed:", error);
    return null;
  }
}

/**
 * Classifica uma transação usando todas as estratégias disponíveis
 * Ordem de prioridade: Regras > Histórico > IA
 */
export async function classifyTransaction(
  userId: number,
  transaction: ParsedTransaction,
  accountId: number,
  rules: ClassificationRule[],
  categories: Category[]
): Promise<ClassificationResult> {
  // 1. Tentar regras primeiro (mais confiável)
  // AGORA PASSAMOS O VALOR (AMOUNT) PARA VALIDAR REGRAS DE VALOR
  const ruleResult = await applyRules(transaction.description, transaction.amount, accountId, rules);
  if (ruleResult) {
    return ruleResult;
  }
  
  // 2. Tentar histórico (baseado em padrões anteriores)
  const historyResult = await classifyByHistory(userId, transaction.description);
  if (historyResult && historyResult.confidence >= 70) {
    return historyResult;
  }
  
  // 3. IA desabilitada temporariamente para acelerar importação
  // TODO: Implementar classificação por IA em background
  // const aiResult = await classifyByAI(transaction.description, categories);
  
  // 4. Se histórico tem baixa confiança, retornar como sugestão
  if (historyResult) {
    return {
      categoryId: null,
      method: "manual",
      confidence: 0,
      suggestedCategoryId: historyResult.categoryId ?? undefined,
    };
  }
  
  // 5. Sem classificação automática
  return {
    categoryId: null,
    method: "manual",
    confidence: 0,
  };
}

/**
 * Classifica múltiplas transações em lote
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
 * Cria regras de classificação baseadas nas regras do briefing
 */
export function getDefaultRules(userId: number, categories: Map<string, number>): Array<{
  userId: number;
  pattern: string;
  matchType: "contains" | "starts_with";
  categoryId: number;
  transactionType: "income" | "expense";
  priority: number;
  minAmount?: number;
  maxAmount?: number;
}> {
  const rules: Array<{
    userId: number;
    pattern: string;
    matchType: "contains" | "starts_with";
    categoryId: number;
    transactionType: "income" | "expense";
    priority: number;
    minAmount?: number;
    maxAmount?: number;
  }> = [];
  
  // Regra 1: TRANSFERÊNCIA RECEBIDA → PIX RECEBIDO CLIENTE
  const pixRecebidoId = categories.get("PIX RECEBIDO CLIENTE");
  if (pixRecebidoId) {
    rules.push({
      userId,
      pattern: "TRANSFERÊNCIA RECEBIDA",
      matchType: "starts_with",
      categoryId: pixRecebidoId,
      transactionType: "income",
      priority: 10,
    });
  }
  
  // Regra 2: DB → RECEBIMENTO EM DÉBITO (Itaú)
  const debitoId = categories.get("DÉBITO");
  if (debitoId) {
    rules.push({
      userId,
      pattern: "DB",
      matchType: "contains",
      categoryId: debitoId,
      transactionType: "income",
      priority: 9,
    });
  }
  
  // Regra 3: AT → RECEBIMENTO EM CRÉDITO (Itaú)
  const creditoId = categories.get("CRÉDITO");
  if (creditoId) {
    rules.push({
      userId,
      pattern: "AT",
      matchType: "contains",
      categoryId: creditoId,
      transactionType: "income",
      priority: 9,
    });
  }
  
  // Regra 5: Nomes de contas internas → TRANSF INTERNA
  const transfInternaId = categories.get("TRANSF INTERNA");
  if (transfInternaId) {
    const internalNames = ["wayou", "cresci e perdi", "fábio esidro"];
    internalNames.forEach((name, index) => {
      rules.push({
        userId,
        pattern: name,
        matchType: "contains",
        categoryId: transfInternaId,
        transactionType: "expense",
        priority: 8 - index,
      });
    });
  }
  
  return rules;
}
