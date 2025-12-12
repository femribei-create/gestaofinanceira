/**
 * tRPC Router para importação de arquivos OFX/CSV
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { parseFile, parseRevenueCSV, type ParsedTransaction } from "../parsers";
import { detectDuplicatesBatch, getDuplicateStats } from "../duplicateDetection";
import { classifyTransactionsBatch } from "../classification";
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
      
      // Buscar transações existentes do usuário
      const existingTransactions = await getUserTransactions(userId);
      
      // Detectar duplicatas
      const duplicates = detectDuplicatesBatch(
        parseResult.transactions,
        existingTransactions
      );
      
      const duplicateStats = getDuplicateStats(duplicates);
      
      // Buscar categorias e regras para classificação
      const categories = await getUserCategories(userId);
      const rules = await getUserClassificationRules(userId);
      
      // Classificar transações
      const classifications = await classifyTransactionsBatch(
        userId,
        parseResult.transactions,
        input.accountId,
        rules,
        categories
      );
      
      // Combinar resultados
      const transactionsWithMetadata = parseResult.transactions.map((trx, index) => {
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
      
      const transactionsToInsert: InsertTransaction[] = input.transactions.map(trx => ({
        userId,
        accountId: input.accountId,
        categoryId: trx.categoryId,
        description: trx.description,
        amount: trx.transactionType === "expense" ? -trx.amount : trx.amount,
        transactionType: trx.transactionType,
        purchaseDate: new Date(trx.purchaseDate),
        paymentDate: new Date(trx.paymentDate),
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
      }));
      
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
