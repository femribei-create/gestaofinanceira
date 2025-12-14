import { router, publicProcedure } from "../_core/trpc"; // <--- O segredo é este "_core"
import { accounts } from "@/db/schema"; 

export const accountsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(accounts);
  }),
});
