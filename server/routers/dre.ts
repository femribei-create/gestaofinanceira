import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDREComparative, getRevenues, upsertRevenuesBatch } from "../dre";
import { parseRevenueCSV } from "../parsers";

export const dreRouter = router({
  /**
   * Obter DRE mensal com histórico comparativo
   */
  getMonthlyDRE: protectedProcedure
    .input(
      z.object({
        monthsToShow: z.number().min(1).max(12).optional().default(3),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      return getDREComparative(ctx.user.id, input.monthsToShow);
    }),

  /**
   * Obter receitas para um ano específico
   */
  getRevenues: protectedProcedure
    .input(
      z.object({
        year: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      return getRevenues(ctx.user.id, input.year);
    }),

  /**
   * Upload de CSV de receitas
   */
  uploadRevenuesCSV: protectedProcedure
    .input(
      z.object({
        csvContent: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("User not authenticated");
      
      const { data, errors } = parseRevenueCSV(input.csvContent);
      
      console.log('[DRE Upload] Dados parseados:', data);
      
      if (errors.length > 0) {
        console.error('[DRE Upload] Erros:', errors);
        throw new Error(errors.join('; '));
      }
      
      // Salvar as receitas no banco
      await upsertRevenuesBatch(ctx.user.id, data);
      
      console.log('[DRE Upload] Dados salvos com sucesso!');
      
      return {
        success: true,
        count: data.length,
        data: data, // Retorna os dados para debug
      };
    }),
});
