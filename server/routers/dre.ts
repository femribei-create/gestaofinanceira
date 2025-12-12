import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDREComparative } from "../dre";

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
      const userId = ctx.user.id;
      return getDREComparative(userId, input.monthsToShow);
    }),
});
