import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { transactions } from "@/db/schema"; 
import { eq, and, gte, lte, desc, like } from "drizzle-orm";

export const transactionsRouter = router({
  // 1. LISTAGEM (Com todos os filtros funcionando)
  list: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        // Alterado para number para casar com o ID do banco
        accountId: z.number().optional(), 
        categoryId: z.number().optional(),
        transactionType: z.enum(["income", "expense"]).optional(),
        search: z.string().optional(),
        status: z.enum(["active", "ignored", "all"]).default("active"), 
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Lista de condições (começa vazia e vamos enchendo)
      const whereConditions = [];

      // 1. Filtro de Datas (Usando purchaseDate conforme seu schema)
      if (input.startDate) whereConditions.push(gte(transactions.purchaseDate, input.startDate));
      if (input.endDate) whereConditions.push(lte(transactions.purchaseDate, input.endDate));

      // 2. Filtro de Conta (Agora aceita número corretamente)
      if (input.accountId) {
        whereConditions.push(eq(transactions.accountId, input.accountId));
      }

      // 3. Filtro de Categoria
      if (input.categoryId) {
        whereConditions.push(eq(transactions.categoryId, input.categoryId));
      }

      // 4. Filtro de Tipo (Receita ou Despesa)
      if (input.transactionType) {
        whereConditions.push(eq(transactions.transactionType, input.transactionType));
      }

      // 5. Busca por Texto (Descrição)
      // O símbolo % antes e depois permite buscar partes da palavra (ex: "luz" acha "conta de luz")
      if (input.search) {
        whereConditions.push(like(transactions.description, `%${input.search}%`));
      }

      // 6. Filtro de Status (Ignoradas vs Ativas)
      if (input.status === "active") {
        whereConditions.push(eq(transactions.isIgnored, false)); // Esconde lixeira
      } else if (input.status === "ignored") {
        whereConditions.push(eq(transactions.isIgnored, true)); // Só mostra lixeira
      }
      // Se for "all", não faz nada e traz tudo.

      return db
        .select()
        .from(transactions)
        .where(and(...whereConditions))
        .orderBy(desc(transactions.purchaseDate));
    }),

  // 2. ALTERNAR IGNORAR (Olho)
  toggleIgnore: publicProcedure
    .input(z.object({ id: z.number() })) // ID deve ser number
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Correção de segurança para evitar erro se não achar a transação
      const transaction = await db.select().from(transactions).where(eq(transactions.id, input.id)).limit(1);
      
      if (!transaction[0]) throw new Error("Transação não encontrada");

      await db.update(transactions)
        .set({ isIgnored: !transaction[0].isIgnored })
        .where(eq(transactions.id, input.id));
      return { success: true, isIgnored: !transaction[0].isIgnored };
    }),

  // 3. DELETAR (Lixeira)
  delete: publicProcedure
    .input(z.object({ id: z.number() })) // ID deve ser number
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),
});
