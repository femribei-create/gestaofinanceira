import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
// CORREÇÃO FINAL: Pegamos o getDb direto da fonte (../db) e não do engine
import { getDb } from "../db"; 
import { transactions } from "../../drizzle/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export const transactionsRouter = router({
  /**
   * Listar transações com filtros
   */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        accountId: z.number().optional(),
        categoryId: z.number().optional(),
        transactionType: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        isDuplicate: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(transactions.userId, ctx.user.id)];

      // Filtro de Texto
      if (input.search) {
        conditions.push(sql`LOWER(${transactions.description}) LIKE ${`%${input.search.toLowerCase()}%`}`);
      }

      // Filtros de Conta e Categoria
      if (input.accountId) {
        conditions.push(eq(transactions.accountId, input.accountId));
      }
      if (input.categoryId) {
        conditions.push(eq(transactions.categoryId, input.categoryId));
      }

      // Filtro de Tipo (Receita/Despesa)
      if (input.transactionType === "income" || input.transactionType === "expense") {
        conditions.push(eq(transactions.transactionType, input.transactionType));
      }

      // Filtro de Data
      if (input.startDate) {
        conditions.push(gte(transactions.purchaseDate, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lte(transactions.purchaseDate, new Date(input.endDate)));
      }
      
      // Filtro de Duplicatas (se não especificado, mostra tudo)
      if (input.isDuplicate !== undefined) {
         conditions.push(eq(transactions.isDuplicate, input.isDuplicate));
      }

      return await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.purchaseDate));
    }),

  /**
   * Atualizar Categoria
   */
  updateCategory: protectedProcedure
    .input(
      z.object({
        transactionId: z.number(),
        categoryId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database error");

      await db
        .update(transactions)
        .set({ 
          categoryId: input.categoryId,
          classificationMethod: "manual",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactions.id, input.transactionId),
            eq(transactions.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Alternar status de ignorar (Eye Off/On)
   */
  toggleIgnore: protectedProcedure
    .input(z.object({ transactionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database error");

      // Buscar estado atual
      const transaction = await db.query.transactions.findFirst({
        where: and(eq(transactions.id, input.transactionId), eq(transactions.userId, ctx.user.id)),
      });

      if (!transaction) throw new Error("Transação não encontrada");

      // Inverter estado
      const newState = !transaction.isIgnored;

      await db
        .update(transactions)
        .set({ 
          isIgnored: newState,
          updatedAt: new Date()
        })
        .where(eq(transactions.id, input.transactionId));

      return { success: true, isIgnored: newState };
    }),

  /**
   * Deletar Transação permanentemente
   */
  delete: protectedProcedure
    .input(z.object({ transactionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database error");

      await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, input.transactionId),
            eq(transactions.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
