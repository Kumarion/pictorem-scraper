import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import scrapePictorem from "~/server/ServerFunctions/scrapePictorem";
import { createJob, deleteJob, fetchJob } from "~/server/ServerFunctions/jobsHandler";

import type { ScrapeResult } from "~/types";

export const scraperRouter = createTRPCRouter({

  // When we submit a url to scrape, we create the jobId created on the client, then fetch the progress of that jobId
  getProgress: publicProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .query(({ input }) => {
      const { jobId } = input;

      const job = fetchJob(jobId);

      if (!job) {
        return {
          progress: 0,
          maxProgress: 0,
        };
      }

      return {
        progress: job.progress,
        maxProgress: job.maxProgress,
      };
    }),

  scrapePictoremGallery: publicProcedure
    .input(z.object({ 
      url: z.string().url(),
      jobId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { url, jobId } = input;

      console.log("Creating job.");
      createJob(url, jobId);

      console.log("Starting scraping process.");
      const { data, pages } = await scrapePictorem(url, jobId);

      // remove job from jobs list
      deleteJob(jobId);

      // return the data and pages
      return {
        data,
        pages,
      } as {
        data: ScrapeResult[];
        pages: number;
      };
    }),
});
