/**
 * Detecção de duplicatas usando Fuzzy Matching
 * Compara transações por Data + Valor + Descrição similar
 */

// CORREÇÃO: Garantindo caminho relativo para o Schema
import type { Transaction } from "../drizzle/schema";
import type { ParsedTransaction } from "./parsers";

export interface DuplicateMatch {
  existingTransaction: Transaction;
  newTransaction: ParsedTransaction;
  similarity: number; // 0-100
  reason: string;
}

/**
 * Calcula a similaridade entre duas strings usando Levenshtein Distance
 * Retorna um valor entre 0 (totalmente diferente) e 100 (idêntico)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return len2 === 0 ? 100 : 0;
  if (len2 === 0) return 0;
  
  // Matriz de distância de Levenshtein
  const matrix: number[][] = [];
  
  // Inicializar primeira linha e coluna
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0]![j] = j;
  }
  
  // Preencher matriz
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,       // Deleção
        matrix[i]![j - 1]! + 1,       // Inserção
        matrix[i - 1]![j - 1]! + cost // Substituição
      );
    }
  }
  
  const distance = matrix[len1]![len2]!;
  const maxLen = Math.max(len1, len2);
  
  // Converter distância para similaridade percentual
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Normaliza uma descrição para comparação
 * Remove caracteres especiais, espaços extras, etc.
 */
function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .trim()
    // Remover múltiplos espaços
    .replace(/\s+/g, ' ')
    // Remover caracteres especiais comuns
    .replace(/[*]/g, '')
    // Remover números de parcela (já foram extraídos)
    .replace(/\(\d+\/\d+\)/g, '')
    .replace(/\d+\/\d+/g, '')
    .trim();
}

/**
 * Verifica se duas datas são iguais (mesmo dia)
 */
function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Verifica se duas datas estão próximas (diferença de até N dias)
 */
function isDateClose(date1: Date, date2: Date, maxDays: number = 3): boolean {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  return daysDiff <= maxDays;
}

/**
 * Verifica se dois valores são iguais ou muito próximos
 */
function isAmountSimilar(amount1: number, amount2: number, tolerance: number = 100): boolean {
  // tolerance em centavos (default: R$ 1,00)
  return Math.abs(amount1 - amount2) <= tolerance;
}

/**
 * Detecta duplicatas exatas (para arquivos OFX/CSV)
 * Critério: Data + Valor + Descrição idênticos
 */
export function findExactDuplicates(
  newTransaction: ParsedTransaction,
  existingTransactions: Transaction[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  
  const newDesc = normalizeDescription(newTransaction.description);
  
  for (const existing of existingTransactions) {
    const existingDesc = normalizeDescription(existing.description);
    
    // Verificar data exata
    if (!isSameDate(newTransaction.purchaseDate, existing.purchaseDate)) {
      continue;
    }
    
    // Verificar valor exato
    if (newTransaction.amount !== Math.abs(existing.amount)) {
      continue;
    }
    
    // Verificar descrição exata
    if (newDesc === existingDesc) {
      matches.push({
        existingTransaction: existing,
        newTransaction,
        similarity: 100,
        reason: "Data + Valor + Descrição idênticos",
      });
    }
  }
  
  return matches;
}

/**
 * Detecta duplicatas com Fuzzy Matching (para lançamentos manuais)
 * Critério: Data + Valor similar + Descrição parecida (>= 80% similaridade)
 */
export function findFuzzyDuplicates(
  newTransaction: ParsedTransaction,
  existingTransactions: Transaction[],
  options: {
    minSimilarity?: number; // Mínimo de similaridade (0-100)
    dateTolerance?: number; // Dias de tolerância na data
    amountTolerance?: number; // Centavos de tolerância no valor
  } = {}
): DuplicateMatch[] {
  const {
    minSimilarity = 80,
    dateTolerance = 3,
    amountTolerance = 100, // R$ 1,00
  } = options;
  
  const matches: DuplicateMatch[] = [];
  const newDesc = normalizeDescription(newTransaction.description);
  
  for (const existing of existingTransactions) {
    // Verificar data próxima
    if (!isDateClose(newTransaction.purchaseDate, existing.purchaseDate, dateTolerance)) {
      continue;
    }
    
    // Verificar valor similar
    if (!isAmountSimilar(newTransaction.amount, Math.abs(existing.amount), amountTolerance)) {
      continue;
    }
    
    // Calcular similaridade da descrição
    const existingDesc = normalizeDescription(existing.description);
    const similarity = calculateStringSimilarity(newDesc, existingDesc);
    
    if (similarity >= minSimilarity) {
      matches.push({
        existingTransaction: existing,
        newTransaction,
        similarity,
        reason: `Data próxima + Valor similar + Descrição ${similarity}% similar`,
      });
    }
  }
  
  // Ordenar por similaridade (maior primeiro)
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Detecta duplicatas por FITID (para arquivos OFX)
 * FITID é um identificador único fornecido pelo banco
 */
export function findDuplicatesByFitId(
  fitId: string,
  existingTransactions: Transaction[]
): Transaction | undefined {
  return existingTransactions.find(t => t.fitId === fitId);
}

/**
 * Detecta todas as duplicatas possíveis para uma nova transação
 * Retorna um objeto com duplicatas exatas, fuzzy e por FITID
 */
export function detectAllDuplicates(
  newTransaction: ParsedTransaction,
  existingTransactions: Transaction[]
): {
  exactMatches: DuplicateMatch[];
  fuzzyMatches: DuplicateMatch[];
  fitIdMatch?: Transaction;
  hasDuplicates: boolean;
} {
  // Verificar FITID primeiro (mais confiável)
  let fitIdMatch: Transaction | undefined;
  if (newTransaction.fitId) {
    fitIdMatch = findDuplicatesByFitId(newTransaction.fitId, existingTransactions);
  }
  
  // Buscar duplicatas exatas
  const exactMatches = findExactDuplicates(newTransaction, existingTransactions);
  
  // Buscar duplicatas fuzzy (apenas se não houver exatas)
  const fuzzyMatches = exactMatches.length === 0
    ? findFuzzyDuplicates(newTransaction, existingTransactions)
    : [];
  
  return {
    exactMatches,
    fuzzyMatches,
    fitIdMatch,
    hasDuplicates: !!fitIdMatch || exactMatches.length > 0 || fuzzyMatches.length > 0,
  };
}

/**
 * Detecta duplicatas em lote para múltiplas transações
 * Útil para importação de arquivos
 */
export function detectDuplicatesBatch(
  newTransactions: ParsedTransaction[],
  existingTransactions: Transaction[]
): Map<number, {
  exactMatches: DuplicateMatch[];
  fuzzyMatches: DuplicateMatch[];
  fitIdMatch?: Transaction;
}> {
  const results = new Map<number, {
    exactMatches: DuplicateMatch[];
    fuzzyMatches: DuplicateMatch[];
    fitIdMatch?: Transaction;
  }>();
  
  for (let i = 0; i < newTransactions.length; i++) {
    const newTrx = newTransactions[i]!;
    const detection = detectAllDuplicates(newTrx, existingTransactions);
    
    if (detection.hasDuplicates) {
      results.set(i, {
        exactMatches: detection.exactMatches,
        fuzzyMatches: detection.fuzzyMatches,
        fitIdMatch: detection.fitIdMatch,
      });
    }
  }
  
  return results;
}

/**
 * Calcula estatísticas de duplicatas para um lote
 */
export function getDuplicateStats(
  duplicates: Map<number, {
    exactMatches: DuplicateMatch[];
    fuzzyMatches: DuplicateMatch[];
    fitIdMatch?: Transaction;
  }>
): {
  total: number;
  exactCount: number;
  fuzzyCount: number;
  fitIdCount: number;
} {
  let exactCount = 0;
  let fuzzyCount = 0;
  let fitIdCount = 0;
  
  Array.from(duplicates.values()).forEach(detection => {
    if (detection.fitIdMatch) fitIdCount++;
    if (detection.exactMatches.length > 0) exactCount++;
    if (detection.fuzzyMatches.length > 0) fuzzyCount++;
  });
  
  return {
    total: duplicates.size,
    exactCount,
    fuzzyCount,
    fitIdCount,
  };
}
