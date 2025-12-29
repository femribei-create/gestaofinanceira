import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { transactions, categories, accounts } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, like } from "drizzle-orm";

export const transactionsRouter = router({
  // 1. LISTAGEM (Versão Estável e Limpa)
  list: protectedProcedure
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
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");
      
      const whereConditions = [eq(transactions.userId, ctx.user.id)];

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
      if (input.status === "active") {
        whereConditions.push(eq(transactions.isIgnored, false));
      } else if (input.status === "ignored") {
        whereConditions.push(eq(transactions.isIgnored, true));
      }

      return ctx.db
        .select()
        .from(transactions)
        .where(and(...whereConditions))
        .orderBy(desc(transactions.purchaseDate));
    }),

  // 2. CRIAR TRANSAÇÃO MANUALMENTE
  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1, "Descrição é obrigatória"),
        amount: z.number().positive("Valor deve ser positivo"),
        transactionType: z.enum(["income", "expense"]),
        purchaseDate: z.date(),
        paymentDate: z.date().optional(),
        accountId: z.number(),
        categoryId: z.number().optional().nullable(),
        isInstallment: z.boolean().default(false),
        installmentNumber: z.number().optional(),
        installmentTotal: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      // Validar se a conta existe e pertence ao usuário
      const account = await ctx.db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .limit(1);
      
      if (!account[0]) throw new Error("Conta não encontrada");

      // Validar se a categoria existe e pertence ao usuário (se fornecida)
      if (input.categoryId) {
        const category = await ctx.db
          .select()
          .from(categories)
          .where(and(eq(categories.id, input.categoryId), eq(categories.userId, ctx.user.id)))
          .limit(1);
        
        if (!category[0]) throw new Error("Categoria não encontrada");
      }

      // Validar se é parcela
      if (input.isInstallment) {
        if (!input.installmentNumber || !input.installmentTotal) {
          throw new Error("Número e total de parcelas são obrigatórios");
        }
        if (input.installmentNumber < 1 || input.installmentNumber > input.installmentTotal) {
          throw new Error("Número da parcela inválido");
        }
      }

      // Converter valor de reais para centavos (multiplicar por 100)
      const amountInCents = Math.round(input.amount * 100);

      // Usar paymentDate fornecida ou usar purchaseDate como padrão
      const paymentDate = input.paymentDate || input.purchaseDate;

      // Inserir a transação
      const result = await ctx.db.insert(transactions).values({
        userId: ctx.user.id,
        accountId: input.accountId,
        categoryId: input.categoryId || null,
        description: input.description,
        amount: amountInCents,
        transactionType: input.transactionType,
        purchaseDate: input.purchaseDate,
        paymentDate: paymentDate,
        isInstallment: input.isInstallment,
        installmentNumber: input.installmentNumber || null,
        installmentTotal: input.installmentTotal || null,
        source: "manual",
        classificationMethod: input.categoryId ? "manual" : null,
        isIgnored: false,
      });

      return { 
        success: true, 
        message: "Transação criada com sucesso!",
        transactionId: result[0]?.insertId 
      };
    }),

  // 3. ALTERNAR IGNORAR
  toggleIgnore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      const transaction = await ctx.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id)))
        .limit(1);
      
      if (!transaction[0]) throw new Error("Transação não encontrada");

      await ctx.db.update(transactions)
        .set({ isIgnored: !transaction[0].isIgnored })
        .where(eq(transactions.id, input.id));
      
      return { success: true, isIgnored: !transaction[0].isIgnored };
    }),

  // 4. DELETAR
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      // Verificar se a transação pertence ao usuário
      const transaction = await ctx.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id)))
        .limit(1);
      
      if (!transaction[0]) throw new Error("Transação não encontrada");

      await ctx.db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),

  // 5. ATUALIZAR CATEGORIA
  updateCategory: protectedProcedure
    .input(z.object({ 
      id: z.number(),
      categoryId: z.number().nullable()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      // Verificar se a transação pertence ao usuário
      const transaction = await ctx.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id)))
        .limit(1);
      
      if (!transaction[0]) throw new Error("Transação não encontrada");

      // Se categoryId foi fornecido, validar se a categoria existe e pertence ao usuário
      if (input.categoryId !== null) {
        const category = await ctx.db
          .select()
          .from(categories)
          .where(and(eq(categories.id, input.categoryId), eq(categories.userId, ctx.user.id)))
          .limit(1);
        
        if (!category[0]) throw new Error("Categoria não encontrada");
      }

      await ctx.db.update(transactions)
        .set({ 
          categoryId: input.categoryId,
          classificationMethod: "manual"
        })
        .where(eq(transactions.id, input.id));
      
      return { success: true };
    }),

  // 6. ATUALIZAR MÚLTIPLAS TRANSAÇÕES EM LOTE
  bulkUpdate: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()),
      updates: z.object({
        categoryId: z.number().nullable().optional(),
        accountId: z.number().optional(),
        purchaseDate: z.date().optional(),
      })
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      if (input.ids.length === 0) throw new Error("Nenhuma transação selecionada");

      // Validar se todas as transações pertencem ao usuário
      const userTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.userId, ctx.user.id),
          eq(transactions.id, input.ids[0])
        ));

      if (!userTransactions[0]) throw new Error("Transações não encontradas");

      // Validar categoria se fornecida
      if (input.updates.categoryId !== undefined && input.updates.categoryId !== null) {
        const category = await ctx.db
          .select()
          .from(categories)
          .where(and(eq(categories.id, input.updates.categoryId), eq(categories.userId, ctx.user.id)))
          .limit(1);
        
        if (!category[0]) throw new Error("Categoria não encontrada");
      }

      // Validar banco se fornecido
      if (input.updates.accountId) {
        const account = await ctx.db
          .select()
          .from(accounts)
          .where(and(eq(accounts.id, input.updates.accountId), eq(accounts.userId, ctx.user.id)))
          .limit(1);
        
        if (!account[0]) throw new Error("Conta não encontrada");
      }

      // Preparar dados de atualização
      const updateData: any = {};
      
      if (input.updates.categoryId !== undefined) {
        updateData.categoryId = input.updates.categoryId;
        if (input.updates.categoryId !== null) {
          updateData.classificationMethod = "manual";
        }
      }
      
      if (input.updates.accountId !== undefined) {
        updateData.accountId = input.updates.accountId;
      }
      
      if (input.updates.purchaseDate !== undefined) {
        updateData.purchaseDate = input.updates.purchaseDate;
      }

      // Atualizar todas as transações
      await ctx.db.update(transactions)
        .set(updateData)
        .where(and(
          eq(transactions.userId, ctx.user.id),
          eq(transactions.id, input.ids[0])
        ));

      // Atualizar as demais transações individualmente
      for (const id of input.ids.slice(1)) {
        await ctx.db.update(transactions)
          .set(updateData)
          .where(eq(transactions.id, id));
      }

      return { success: true, updatedCount: input.ids.length };
    }),

  // 7. DELETAR MÚLTIPLAS TRANSAÇÕES EM LOTE
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      if (input.ids.length === 0) throw new Error("Nenhuma transação selecionada");

      // Validar se todas as transações pertencem ao usuário
      const userTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.userId, ctx.user.id),
          eq(transactions.id, input.ids[0])
        ));

      if (!userTransactions[0]) throw new Error("Transações não encontradas");

      // Deletar todas as transações
      for (const id of input.ids) {
        await ctx.db.delete(transactions)
          .where(and(
            eq(transactions.id, id),
            eq(transactions.userId, ctx.user.id)
          ));
      }

      return { success: true, deletedCount: input.ids.length };
    }),

  // 8. ALTERNAR IGNORAR MÚLTIPLAS TRANSAÇÕES EM LOTE
  bulkToggleIgnore: protectedProcedure
    .input(z.object({ 
      ids: z.array(z.number()),
      ignore: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      if (input.ids.length === 0) throw new Error("Nenhuma transação selecionada");

      // Validar se todas as transações pertencem ao usuário
      const userTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.userId, ctx.user.id),
          eq(transactions.id, input.ids[0])
        ));

      if (!userTransactions[0]) throw new Error("Transações não encontradas");

      // Atualizar todas as transações
      for (const id of input.ids) {
        await ctx.db.update(transactions)
          .set({ isIgnored: input.ignore })
          .where(eq(transactions.id, id));
      }

      return { success: true, updatedCount: input.ids.length };
    }),
});
