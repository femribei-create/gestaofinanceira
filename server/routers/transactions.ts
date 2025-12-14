import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { transactions } from "@/db/schema"; 
import { eq, and, gte, lte, desc } from "drizzle-orm";

export const transactionsRouter = router({
  // 1. LISTAGEM (Com filtros de Data, Conta e Status)
  list: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        accountId: z.string().optional(),
        status: z.enum(["active", "ignored", "all"]).default("active"), 
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Lista de condições (o filtro começa vazio)
      const whereConditions = [];

      // Filtro de Datas
      if (input.startDate) whereConditions.push(gte(transactions.date, input.startDate));
      if (input.endDate) whereConditions.push(lte(transactions.date, input.endDate));

      // Filtro de Conta (Só aplica se não for "all")
      if (input.accountId && input.accountId !== "all") {
        whereConditions.push(eq(transactions.accountId, input.accountId));
      }

      // Filtro de Status (Ignoradas vs Ativas)
      if (input.status === "active") {
        whereConditions.push(eq(transactions.isIgnored, false)); // Esconde lixeira
      } else if (input.status === "ignored") {
        whereConditions.push(eq(transactions.isIgnored, true)); // Só mostra lixeira
      }

      return db
        .select()
        .from(transactions)
        .where(and(...whereConditions))
        .orderBy(desc(transactions.date));
    }),

  // 2. ALTERNAR IGNORAR (Olho)
  toggleIgnore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const transaction = await db.select().from(transactions).where(eq(transactions.id, input.id)).limit(1);
      
      if (!transaction[0]) throw new Error("Transação não encontrada");

      await db.update(transactions)
        .set({ isIgnored: !transaction[0].isIgnored })
        .where(eq(transactions.id, input.id));
      return { success: true };
    }),

  // 3. DELETAR (Lixeira)
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),
});
