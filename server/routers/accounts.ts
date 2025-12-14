import { router, publicProcedure } from "../trpc";
import { accounts } from "@/db/schema"; 

export const accountsRouter = router({
  // Busca todas as contas cadastradas para preencher o select
  list: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(accounts);
  }),
});
