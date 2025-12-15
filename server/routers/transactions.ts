import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
// Importação correta para o Railway
import { transactions } from "../../drizzle/schema"; 
import { eq, and, gte, lte, desc, like } from "drizzle-orm";

export const transactionsRouter = router({
  // 1. LISTAGEM COMPLETA
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

      // 1. Filtro de Datas
      if (input.startDate) whereConditions.push(gte(transactions.purchaseDate, input.startDate));
      if (input.endDate) whereConditions.push(lte(transactions.purchaseDate, input.endDate));

      // 2. Filtro de Conta
      if (input.accountId) {
        whereConditions.push(eq(transactions.accountId, input.accountId));
      }

      // 3. Filtro de Categoria
      if (input.categoryId) {
        whereConditions.push(eq(transactions.categoryId, input.categoryId));
      }

      // 4. Filtro de Tipo
      if (input.transactionType) {
        whereConditions.push(eq(transactions.transactionType, input.transactionType));
      }

      // 5. Busca por Texto
      if (input.search) {
        whereConditions.push(like(transactions.description, `%${input.search}%`));
      }

      // 6. Filtro de Status (Lógica padrão limpa)
      // Como rodamos o SQL, não existem mais nulos, então 'false' pega tudo que é ativo.
      if (input.status === "active") {
        whereConditions.push(eq(transactions.isIgnored, false));
      } else if (input.status === "ignored") {
        whereConditions.push(eq(transactions.isIgnored, true));
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
