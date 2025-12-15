import { router, publicProcedure } from "../_core/trpc";
// CORREÇÃO CRÍTICA: Trocamos '@/db/schema' pelo caminho relativo real
import { accounts } from "../../drizzle/schema";

export const accountsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    // Agora o servidor consegue encontrar a tabela 'accounts' corretamente
    return await ctx.db.select().from(accounts);
  }),
});
