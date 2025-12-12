import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { setupRouter } from "./routers/setup";
import { categorizationRouter } from "./routers/categorization";
import { transactionsRouter } from "./routers/transactions";
import { dreRouter } from "./routers/dre";
import { importRouter } from "./routers/import";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  setup: setupRouter,
  categorization: categorizationRouter,
  transactions: transactionsRouter,
  dre: dreRouter,
  import: importRouter,
});

export type AppRouter = typeof appRouter;
