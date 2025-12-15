import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { transactions } from "../../drizzle/schema"; 
import { eq, and, gte, lte, desc, like, or, isNull } from "drizzle-orm";

export const transactionsRouter = router({
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
      // === ÁREA DE DEBUG (RAIO-X) ===
      console.log(">>> INICIO DO DEBUG <<<");
      console.log("Filtros recebidos do Frontend:", JSON.stringify(input));

      const { db } = ctx;
      const whereConditions = [];

      if (input.startDate) whereConditions.push(gte(transactions.purchaseDate, input.startDate));
      if (input.endDate) whereConditions.push(lte(transactions.purchaseDate, input.endDate));
      
      if (input.accountId) whereConditions.push(eq(transactions.accountId, input.accountId));
      if (input.categoryId) whereConditions.push(eq(transactions.categoryId, input.categoryId));
      if (input.transactionType) whereConditions.push(eq(transactions.transactionType, input.transactionType));
      
      if (input.search) whereConditions.push(like(transactions.description, `%${input.search}%`));

      // Lógica de Status
      if (input.status === "active") {
        whereConditions.push(or(eq(transactions.isIgnored, false), isNull(transactions.isIgnored)));
      } else if (input.status === "ignored") {
        whereConditions.push(eq(transactions.isIgnored, true));
      }

      // Executa a busca
      const result = await db
        .select()
        .from(transactions)
        .where(and(...whereConditions))
        .orderBy(desc(transactions.purchaseDate));
      
      console.log(`>>> RESULTADO: Encontrei ${result.length} transações no banco.`);
      if (result.length > 0) {
        console.log("Exemplo da primeira transação encontrada:", JSON.stringify(result[0]));
      }
      console.log(">>> FIM DO DEBUG <<<");

      return result;
    }),

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

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),
});
