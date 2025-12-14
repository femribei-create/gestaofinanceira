import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { transactions } from "@/db/schema"; 
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export const transactionsRouter = router({
  // 1. LISTAGEM COM FILTROS AVANÇADOS
  list: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        accountId: z.string().optional(), // Filtro por conta (Ex: NuPJ)
        categoryId: z.string().optional(), // Filtro por categoria
        // "active" = Padrão (não ignoradas), "ignored" = Lixeira, "all" = Tudo
        status: z.enum(["active", "ignored", "all"]).default("active"), 
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Array para acumular as condições do WHERE dinamicamente
      const whereConditions = [];

      // --- Filtro de Datas ---
      if (input.startDate) {
        whereConditions.push(gte(transactions.date, input.startDate));
      }
      if (input.endDate) {
        whereConditions.push(lte(transactions.date, input.endDate));
      }

      // --- Filtro de Conta e Categoria ---
      // Verificamos se existe E se não é "all" (caso venha do frontend)
      if (input.accountId && input.accountId !== "all") {
        whereConditions.push(eq(transactions.accountId, input.accountId));
      }
      if (input.categoryId && input.categoryId !== "all") {
        whereConditions.push(eq(transactions.categoryId, input.categoryId));
      }

      // --- Filtro de Status (Ignorar/Lixeira) ---
      if (input.status === "active") {
        // Mostra apenas as que NÃO foram ignoradas
        whereConditions.push(eq(transactions.isIgnored, false));
      } else if (input.status === "ignored") {
        // Mostra APENAS as ignoradas (Lixeira)
        whereConditions.push(eq(transactions.isIgnored, true));
      }
      // Se for "all", não adicionamos filtro, retornando ambas.

      return db
        .select()
        .from(transactions)
        .where(and(...whereConditions)) // Espalha as condições no AND
        .orderBy(desc(transactions.date), desc(transactions.createdAt)); // Ordena por data e depois criação
    }),

  // 2. CRIAR TRANSAÇÃO MANUAL
  create: publicProcedure
    .input(
      z.object({
        date: z.date(),
        amount: z.number(),
        description: z.string(),
        accountId: z.string(),
        categoryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.insert(transactions).values({
        date: input.date,
        amount: input.amount, // Lembre-se: banco salva em centavos (integer) ou decimal, dependendo da sua config. Aqui assume que já vem correto.
        description: input.description,
        accountId: input.accountId,
        categoryId: input.categoryId,
        isIgnored: false, // Padrão
      });
      return { success: true };
    }),

  // 3. ALTERNAR IGNORAR (Correção do bug undefined aplicada)
  toggleIgnore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Busca segura usando select + limit em vez de query.findFirst
      const transaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, input.id))
        .limit(1);

      const target = transaction[0];

      if (!target) {
        throw new Error("Transação não encontrada");
      }

      // Inverte o valor atual
      await db
        .update(transactions)
        .set({ isIgnored: !target.isIgnored })
        .where(eq(transactions.id, input.id));

      return { success: true, newStatus: !target.isIgnored };
    }),

  // 4. DELETAR (Permanente)
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),
});
