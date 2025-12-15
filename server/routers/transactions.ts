import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
// Mantemos o caminho que sabemos que funciona
import { transactions } from "../../drizzle/schema"; 
// Removemos 'or', 'isNull', 'sql' que estavam causando o crash
import { eq, and, gte, lte, desc, like } from "drizzle-orm";

export const transactionsRouter = router({
  // 1. LISTAGEM (Versão Estável e Limpa)
  list: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        accountId: z.number().optional(), 
        categoryId: z.number().optional(),
        transactionType: z.enum(["income", "expense"]).optional(),
        search: z.string().optional(),
        status: z.enum(["active", "ignored", "all"]).default("active"), 
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      const whereConditions = [];

      // Filtros de Data
      if (input.startDate) whereConditions.push(gte(transactions.purchaseDate, input.startDate));
      if (input.endDate) whereConditions.push(lte(transactions.purchaseDate, input.endDate));

      // Filtros Gerais
      if (input.accountId) whereConditions.push(eq(transactions.accountId, input.accountId));
      if (input.categoryId) whereConditions.push(eq(transactions.categoryId, input.categoryId));
      if (input.transactionType) whereConditions.push(eq(transactions.transactionType, input.transactionType));
      
      // Busca por Texto
      if (input.search) whereConditions.push(like(transactions.description, `%${input.search}%`));

      // Lógica de Status (SIMPLIFICADA)
      // Como seu banco já tem 0 e 1, não precisamos de OR nem isNull.
      if (input.status === "active") {
        whereConditions.push(eq(transactions.isIgnored, false)); // Pega apenas os '0'
      } else if (input.status === "ignored") {
        whereConditions.push(eq(transactions.isIgnored, true)); // Pega apenas os '1'
      }

      return db
        .select()
        .from(transactions)
        .where(and(...whereConditions))
        .orderBy(desc(transactions.purchaseDate));
    }),

  // 2. ALTERNAR IGNORAR
  toggleIgnore: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const transaction = await db.select().from(transactions).where(eq(transactions.id, input.id)).limit(1);
      
      if (!transaction[0]) throw new Error("Transação não encontrada");

      await db.update(transactions)
        .set({ isIgnored: !transaction[0].isIgnored })
        .where(eq(transactions.id, input.id));
      return { success: true, isIgnored: !transaction[0].isIgnored };
    }),

  // 3. DELETAR
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),
});
