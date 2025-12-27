import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { accounts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const accountsRouter = router({
  // 1. LISTAR CONTAS DO USUÁRIO
  list: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      return ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, ctx.user.id));
    }),

  // 2. OBTER CONTA ESPECÍFICA
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      const account = await ctx.db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)))
        .limit(1);

      if (!account[0]) throw new Error("Conta não encontrada");
      return account[0];
    }),

  // 3. CRIAR NOVA CONTA
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nome da conta é obrigatório"),
      accountType: z.enum(["bank", "credit_card"]),
      businessType: z.enum(["personal", "business"]),
      initialBalance: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      const result = await ctx.db.insert(accounts).values({
        userId: ctx.user.id,
        name: input.name,
        accountType: input.accountType,
        businessType: input.businessType,
        initialBalance: input.initialBalance,
        currentBalance: input.initialBalance,
      });

      const newAccountId = Number(result[0].insertId);
      const newAccount = await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.id, newAccountId))
        .limit(1);

      return newAccount[0];
    }),

  // 4. ATUALIZAR CONTA
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      accountType: z.enum(["bank", "credit_card"]).optional(),
      businessType: z.enum(["personal", "business"]).optional(),
      currentBalance: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      // Verificar se a conta pertence ao usuário
      const account = await ctx.db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)))
        .limit(1);

      if (!account[0]) throw new Error("Conta não encontrada");

      // Preparar dados para atualização
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.accountType !== undefined) updateData.accountType = input.accountType;
      if (input.businessType !== undefined) updateData.businessType = input.businessType;
      if (input.currentBalance !== undefined) updateData.currentBalance = input.currentBalance;

      await ctx.db.update(accounts)
        .set(updateData)
        .where(eq(accounts.id, input.id));

      const updatedAccount = await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.id))
        .limit(1);

      return updatedAccount[0];
    }),

  // 5. DELETAR CONTA
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      // Verificar se a conta pertence ao usuário
      const account = await ctx.db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)))
        .limit(1);

      if (!account[0]) throw new Error("Conta não encontrada");

      await ctx.db.delete(accounts).where(eq(accounts.id, input.id));
      return { success: true };
    }),

  // 6. ATUALIZAR SALDO DA CONTA
  updateBalance: protectedProcedure
    .input(z.object({
      id: z.number(),
      newBalance: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) throw new Error("Database not available");
      if (!ctx.user) throw new Error("User not authenticated");

      // Verificar se a conta pertence ao usuário
      const account = await ctx.db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)))
        .limit(1);

      if (!account[0]) throw new Error("Conta não encontrada");

      await ctx.db.update(accounts)
        .set({ 
          currentBalance: input.newBalance,
          updatedAt: new Date()
        })
        .where(eq(accounts.id, input.id));

      return { success: true, newBalance: input.newBalance };
    }),
});
