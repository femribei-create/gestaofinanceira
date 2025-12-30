/**
 * tRPC Router para importação de arquivos OFX/CSV
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { parseFile, parseRevenueCSV, type ParsedTransaction } from "../parsers";
import { detectDuplicatesBatch, getDuplicateStats } from "../duplicateDetection";
import { classifyTransactionsBatch, classifyByHistory } from "../classification";
import {
  getUserAccounts,
  getUserCategories,
  getUserClassificationRules,
  getUserTransactions,
  createTransactionsBulk,
  upsertRevenueData,
  getCategoryByName,
  createCategory,
  createAccount,
} from "../db";
import type { InsertTransaction } from "../../drizzle/schema";
import { cardClosingDates } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Calcula a data de pagamento correta para uma transação
 * Se for parcela de cartão, usa a data de fechamento configurada
 * Senão, usa a data da transação
 */
async function calculatePaymentDate(
  transaction: ParsedTransaction,
  accountId: number,
  userId: number,
  db: any
): Promise<Date> {
  // Se não for parcela, retorna a data da transação
  if (!transaction.isInstallment) {
    return transaction.paymentDate;
  }

  // Se for parcela, busca a data de fechamento configurada
  const purchaseDate = transaction.originalPurchaseDate || transaction.purchaseDate;
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth() + 1; // getMonth() retorna 0-11

  // Buscar data de fechamento configurada para este mês
  const closingDateRecord = await db
    .select()
    .from(cardClosingDates)
    .where(
      and(
        eq(cardClosingDates.userId, userId),
        eq(cardClosingDates.accountId, accountId),
        eq(cardClosingDates.year, year),
        eq(cardClosingDates.month, month)
      )
    )
    .limit(1);

  if (closingDateRecord.length > 0) {
    // Usa a data de fechamento configurada
    return new Date(closingDateRecord[0].closingDate);
  }

  // Se não encontrar configuração, usa a data original (comportamento padrão)
  return transaction.paymentDate;
}

export const importRouter = router({
  /**
   * Upload e parse de arquivo OFX/CSV
   * Retorna transações parseadas com detecção de duplicatas
   */
  uploadFile: protectedProcedure
    .input(z.object({
      content: z.string(),
      fileName: z.string(),
      accountId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Parse do arquivo
      const parseResult = parseFile(input.content, input.fileName);
      
      if (parseResult.errors.length > 0) {
        return {
          success: false,
          errors: parseResult.errors,
          transactions: [],
        };
      }

      // --- FILTRO DE LIMPEZA (ITAÚ e outros lixos) ---
      // Criamos uma nova lista excluindo linhas que são apenas saldo informativo
      const cleanTransactions = parseResult.transactions.filter(trx => {
        const desc = trx.description.toUpperCase();
        
        // Remove linhas de saldo do Itaú
        if (desc.includes("SALDO TOTAL DISPONÍVEL")) return false; // Pega "DIA" e variações
        if (desc.includes("SALDO DO DIA")) return false; 
        
        return true;
      });
      
      // Buscar transações existentes do usuário
      const existingTransactions = await getUserTransactions(userId);
      
      // Detectar duplicatas (Usando a lista limpa)
      const duplicates = detectDuplicatesBatch(
        cleanTransactions,
        existingTransactions
      );
      
      const duplicateStats = getDuplicateStats(duplicates);
      
      // Buscar categorias e regras para classificação
      const categories = await getUserCategories(userId);
      const rules = await getUserClassificationRules(userId);
      
      // Buscar informações da conta para aplicar regras específicas
      const accounts = await getUserAccounts(userId);
      const currentAccount = accounts.find(acc => acc.id === input.accountId);
      
      // Verificar se é Cartão Master ou Cartão Visa - usar APENAS similaridade
      const isCardAccount = currentAccount?.name.toLowerCase().includes('master') || 
                            currentAccount?.name.toLowerCase().includes('visa');
      
      // Classificar transações
      let classifications;
      if (isCardAccount) {
        // Para cartões Master/Visa, usar APENAS classificação por histórico (similaridade)
        classifications = await Promise.all(
          cleanTransactions.map(async (trx) => {
            const result = await classifyByHistory(userId, trx.description);
            if (result) {
              return {
                categoryId: result.categoryId,
                method: result.method,
                confidence: result.confidence,
                suggestedCategoryId: result.categoryId,
              };
            }
            return {
              categoryId: null,
              method: null,
              confidence: 0,
              suggestedCategoryId: null,
            };
          })
        );
      } else {
        classifications = await classifyTransactionsBatch(
          userId,
          cleanTransactions,
          input.accountId,
          rules,
          categories
        );
        
        // Aplicar regras específicas por conta
        if (currentAccount?.name.toLowerCase().includes('sangria')) {
          // Todas as transações do Sangria devem ser PIX DESAPEGO
          const pixDesapegoCategory = categories.find(cat => 
            cat.name.toUpperCase() === 'PIX DESAPEGO'
          );
          
          if (pixDesapegoCategory) {
            classifications.forEach((classification, index) => {
              classifications[index] = {
                categoryId: pixDesapegoCategory.id,
                method: "rule",
                confidence: 100,
              };
            });
          }
        }
      }
      
      // Combinar resultados (Usando a lista limpa)
      const transactionsWithMetadata = cleanTransactions.map((trx, index) => {
        const duplicate = duplicates.get(index);
        const classification = classifications[index]!;
        
        // Pegar a primeira transação existente como referência
        let existingTrx = null;
        if (duplicate) {
          const match = duplicate.exactMatches[0] || duplicate.fuzzyMatches[0] || duplicate.fitIdMatch;
          if (match) {
            const existing = match.existingTransaction;
            existingTrx = {
              id: existing.id,
              description: existing.description,
              amount: existing.amount,
              purchaseDate: existing.purchaseDate || existing.createdAt,
              transactionType: existing.transactionType,
            };
          }
        }
        
        return {
          ...trx,
          isDuplicate: !!duplicate,
          duplicateInfo: duplicate ? {
            type: duplicate.exactMatches.length > 0 ? 'exact' : 'fuzzy',
            similarity: duplicate.fuzzyMatches[0]?.similarity || 1.0,
            existingTransaction: existingTrx,
          } : undefined,
          classification: {
            categoryId: classification.categoryId,
            method: classification.method,
            confidence: classification.confidence,
            suggestedCategoryId: classification.suggestedCategoryId,
          },
        };
      });
      
      return {
        success: true,
        errors: [],
        transactions: transactionsWithMetadata,
        duplicateStats,
        accountInfo: parseResult.accountInfo,
      };
    }),
  
  /**
   * Confirma importação de transações
   * Salva transações aprovadas no banco de dados
   */
  confirmImport: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      transactions: z.array(z.object({
        description: z.string(),
        amount: z.number(),
        transactionType: z.enum(["income", "expense"]),
        purchaseDate: z.string(), // ISO string
        paymentDate: z.string(), // ISO string
        isInstallment: z.boolean(),
        installmentNumber: z.number().optional(),
        installmentTotal: z.number().optional(),
        originalPurchaseDate: z.string().optional(), // ISO string
        fitId: z.string().optional(),
        source: z.enum(["ofx", "csv"]),
        sourceFile: z.string(),
        categoryId: z.number().nullable(),
        suggestedCategoryId: z.number().optional(),
        classificationMethod: z.enum(["rule", "ai", "history", "manual"]),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Processar transações com cálculo correto de paymentDate
      const transactionsToInsert: InsertTransaction[] = await Promise.all(
        input.transactions.map(async (trx) => {
          // Criar objeto temporário para calcular paymentDate
          const tempTransaction: ParsedTransaction = {
            description: trx.description,
            amount: trx.amount,
            transactionType: trx.transactionType,
            purchaseDate: new Date(trx.purchaseDate),
            paymentDate: new Date(trx.paymentDate),
            isInstallment: trx.isInstallment,
            installmentNumber: trx.installmentNumber,
            installmentTotal: trx.installmentTotal,
            originalPurchaseDate: trx.originalPurchaseDate ? new Date(trx.originalPurchaseDate) : undefined,
            fitId: trx.fitId,
            source: trx.source,
            sourceFile: trx.sourceFile,
          };

          // Calcular paymentDate correto (considerando data de fechamento)
          const correctPaymentDate = await calculatePaymentDate(
            tempTransaction,
            input.accountId,
            userId,
            ctx.db
          );

          return {
            userId,
            accountId: input.accountId,
            categoryId: trx.categoryId,
            description: trx.description,
            // Valores são armazenados como positivos, sinal vem do tipo de transação
            amount: Math.abs(trx.amount),
            transactionType: trx.transactionType,
            purchaseDate: new Date(trx.purchaseDate),
            paymentDate: correctPaymentDate,
            isInstallment: trx.isInstallment,
            installmentNumber: trx.installmentNumber,
            installmentTotal: trx.installmentTotal,
            originalPurchaseDate: trx.originalPurchaseDate ? new Date(trx.originalPurchaseDate) : undefined,
            source: trx.source,
            sourceFile: trx.sourceFile,
            suggestedCategoryId: trx.suggestedCategoryId,
            classificationMethod: trx.classificationMethod,
            isDuplicate: false,
            duplicateStatus: "approved",
            fitId: trx.fitId,
          };
        })
      );
      
      await createTransactionsBulk(transactionsToInsert);
      
      return {
        success: true,
        count: transactionsToInsert.length,
      };
    }),

  /**
   * Upload e importação de CSV de faturamento
   */
  uploadRevenueCSV: protectedProcedure
    .input(z.object({
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      const { data, errors } = parseRevenueCSV(input.content);
      
      if (errors.length > 0) {
        return {
          success: false,
          errors,
          count: 0,
        };
      }
      
      // Salvar dados de faturamento
      for (const revenue of data) {
        await upsertRevenueData({
          userId,
          ...revenue,
        });
      }
      
      return {
        success: true,
        errors: [],
        count: data.length,
      };
    }),
  
  /**
   * Cria conta bancária automaticamente baseada no arquivo OFX
   */
  createAccountFromFile: protectedProcedure
    .input(z.object({
      name: z.string(),
      accountType: z.enum(["bank", "credit_card"]),
      businessType: z.enum(["personal", "business"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      const account = await createAccount({
        userId,
        name: input.name,
        accountType: input.accountType,
        businessType: input.businessType,
        initialBalance: 0,
        currentBalance: 0,
      });
      
      return account;
    }),
});
