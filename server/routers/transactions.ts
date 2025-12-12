/**
 * tRPC Router para gerenciamento de transações
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getUserTransactions,
  updateTransaction,
  deleteTransaction,
  upsertClassificationHistory,
} from "../db";

export const transactionsRouter = router({
  /**
   * Lista transações do usuário com filtros
   */
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(), // Busca por texto na descrição
      accountId: z.number().optional(),
      categoryId: z.number().optional(),
      startDate: z.string().optional(), // ISO string
      endDate: z.string().optional(), // ISO string
      transactionType: z.enum(["income", "expense"]).optional(),
      isDuplicate: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      const filters = {
        search: input.search,
        accountId: input.accountId,
        categoryId: input.categoryId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        transactionType: input.transactionType,
        isDuplicate: input.isDuplicate,
      };
      
      const transactions = await getUserTransactions(userId, filters);
      
      return transactions;
    }),
  
  /**
   * Atualiza categoria de uma transação
   * Também registra no histórico para aprendizado
   */
  updateCategory: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      categoryId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Buscar transação para pegar a descrição
      const transactions = await getUserTransactions(userId);
      const transaction = transactions.find(t => t.id === input.transactionId);
      
      if (!transaction) {
        throw new Error("Transaction not found");
      }
      
      // Atualizar transação
      await updateTransaction(input.transactionId, {
        categoryId: input.categoryId,
        classificationMethod: "manual",
      });
      
      // Registrar no histórico para aprendizado
      await upsertClassificationHistory(
        userId,
        transaction.description,
        input.categoryId
      );
      
      return { success: true };
    }),
  
  /**
   * Aprova ou rejeita duplicata
   */
  handleDuplicate: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      action: z.enum(["approve", "reject"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.action === "approve") {
        await updateTransaction(input.transactionId, {
          isDuplicate: false,
          duplicateStatus: "approved",
        });
      } else {
        await deleteTransaction(input.transactionId);
      }
      
      return { success: true };
    }),
  
  /**
   * Deleta transação
   */
  delete: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await deleteTransaction(input.transactionId);
      
      return { success: true };
    }),
});
