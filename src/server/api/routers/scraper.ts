import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import scrapePictorem from "~/server/ServerFunctions/scrapePictorem";
import { createJob, deleteJob } from "~/server/ServerFunctions/jobsHandler";

import type { ScrapeResult } from "~/types";
import { jobPusher } from "~/utils/pusher";

export const updateJobEvent = (jobId: string, progress: number, maxProgress: number) => {
  // free trial of pusher gets 200,000 messages a day
  // Only continue below every 5% of progress
  // make sure we get the last bit of progress though
  if (progress % Math.floor(maxProgress / 20) !== 0 && progress !== maxProgress) {
    return;
  }

  jobPusher.trigger(jobId, "jobProgress", {
    progress,
    maxProgress,
  }).then(() => {
    console.log("Pusher event sent.");
  }).catch(console.error);
};

export const scraperRouter = createTRPCRouter({
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
