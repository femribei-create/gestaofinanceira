import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  categorizeTransaction,
  learnFromCorrection,
  getUserRules,
  getUserLearningHistory,
  createOrUpdateRule,
  deleteRule,
  deleteHistoryPattern,
  updateHistoryPattern,
  normalizarSinal,
} from "../categorization.engine";

export const categorizationRouter = router({
  /**
   * Categorizar uma transação
   */
  categorize: protectedProcedure
    .input(
      z.object({
        description: z.string(),
        amount: z.number(),
        accountId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      try {
        const result = await categorizeTransaction(
          ctx.user.id,
          input.description,
          input.amount,
          input.accountId
        );
        return result;
      } catch (error) {
        console.error("[Categorization] Erro:", error);
        throw new Error("Erro ao categorizar transação");
      }
    }),

  /**
   * Normalizar sinal de uma transação
   */
  normalizeSinal: protectedProcedure
    .input(
      z.object({
        amount: z.number(),
        fileSource: z.enum([
          "itau",
          "nubank_pj",
          "nubank_pessoal",
          "inter",
          "sangria",
          "cartao_master",
          "cartao_visa",
        ]),
      })
    )
    .query(({ input }) => {
      return normalizarSinal(input.amount, input.fileSource);
    }),

  /**
   * Aprender com correção do usuário
   */
  learnFromCorrection: protectedProcedure
    .input(
      z.object({
        description: z.string(),
        categoryId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      await learnFromCorrection(ctx.user.id, input.description, input.categoryId);
      return { success: true };
    }),

  /**
   * Listar regras do usuário
   */
  listRules: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("User not authenticated");
    
    return getUserRules(ctx.user.id);
  }),

  /**
   * Listar histórico de aprendizado
   */
  listLearningHistory: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("User not authenticated");
    
    return getUserLearningHistory(ctx.user.id);
  }),

  /**
   * Criar nova regra
   */
  createRule: protectedProcedure
    .input(
      z.object({
        pattern: z.string(),
        matchType: z.enum(["contains", "starts_with", "ends_with", "exact"]),
        categoryId: z.number(),
        transactionType: z.enum(["income", "expense"]),
        priority: z.number().default(0),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      await createOrUpdateRule(
        ctx.user.id,
        null,
        input.pattern,
        input.matchType,
        input.categoryId,
        input.transactionType,
        input.priority,
        input.minAmount,
        input.maxAmount
      );
      return { success: true };
    }),

  /**
   * Atualizar regra existente
   */
  updateRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number(),
        pattern: z.string(),
        matchType: z.enum(["contains", "starts_with", "ends_with", "exact"]),
        categoryId: z.number(),
        transactionType: z.enum(["income", "expense"]),
        priority: z.number().default(0),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      await createOrUpdateRule(
        ctx.user.id,
        input.ruleId,
        input.pattern,
        input.matchType,
        input.categoryId,
        input.transactionType,
        input.priority,
        input.minAmount,
        input.maxAmount
      );
      return { success: true };
    }),

  /**
   * Deletar regra
   */
  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      await deleteRule(input.ruleId);
      return { success: true };
    }),

  /**
   * Deletar padrão aprendido
   */
  deleteHistoryPattern: protectedProcedure
    .input(z.object({ patternId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      await deleteHistoryPattern(input.patternId);
      return { success: true };
    }),

  /**
   * Editar padrão aprendido
   */
  updateHistoryPattern: protectedProcedure
    .input(
      z.object({
        patternId: z.number(),
        newDescription: z.string().min(1, "Description cannot be empty"),
        newCategoryId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      try {
        await updateHistoryPattern(
          ctx.user.id,
          input.patternId,
          input.newDescription,
          input.newCategoryId
        );
        return { success: true };
      } catch (error) {
        console.error("[Categorization] Erro ao atualizar padrão:", error);
        throw error;
      }
    }),
});
