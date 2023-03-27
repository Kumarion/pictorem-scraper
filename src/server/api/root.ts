import { createTRPCRouter } from "~/server/api/trpc";
import { scraperRouter } from "~/server/api/routers/scraper";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  scraper: scraperRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
