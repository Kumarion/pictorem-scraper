import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import scrapePictorem from "~/server/ServerFunctions/scrapePictorem";
import { createJob, deleteJob } from "~/server/ServerFunctions/jobsHandler";

import { observable } from "@trpc/server/observable";

import type { ScrapeResult } from "~/types";
import EventEmitter from "events";

const ee = new EventEmitter();

export const updateJobEvent = (jobId: string, progress: number, maxProgress: number) => {
  ee.emit(jobId, {
    progress,
    maxProgress,
  });
};

export const scraperRouter = createTRPCRouter({

  getProgress: publicProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .subscription(( { input } ) => {
      type Data = { progress: number; maxProgress: number };
      const { jobId } = input;

      return observable<Data>((emit) => {
        const onAdd = (data: Data) => {
          // emit data to client
          emit.next(data);
        };
        // trigger `onAdd()` when a new job is added
        ee.on(jobId, onAdd);
        // unsubscribe function when client disconnects or stops subscribing
        return () => {
          ee.off(jobId, onAdd);
        };
      });
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
