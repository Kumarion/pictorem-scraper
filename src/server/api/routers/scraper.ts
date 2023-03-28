import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
// import scrapePictorem from "~/server/ServerFunctions/scrapePictorem";
import { createJob, deleteJob } from "~/server/ServerFunctions/jobsHandler";

// import type { ScrapeResult } from "~/types";
import { jobPusher } from "~/utils/pusher";
import getAllPagesWithUrlsAndNames from "~/server/ServerFunctions/getAllPagesWithUrlsAndNames";
import getNamesAndUrls from "~/server/ServerFunctions/getNamesAndUrls";
import getDataFromProductPage from "~/server/ServerFunctions/getDataFromProductPage";

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
  fetchPages: publicProcedure
    .input(z.object({
      url: z.string().url(),
    }))
    .query(async ({ input }) => {
      const { url } = input;

      // if the url includes ?records=1, ?records=2, etc, then we need to just scrape that page
      if (url.includes("?records=")) {
        return [url];
      }

      // this will the pages to scrape
      const { validUrls } = await getAllPagesWithUrlsAndNames(url);

      // so now we have all the additional pages (not including the base url)
      // we need to add the base url to the array
      console.log("Urls: ", validUrls);
      return validUrls;

      // client now has an idea on the pages it'll need to scrape for the next step
      // the next step being scraping for products (usually 50-70 a page) (so we do one page per request so we dont get a timeout)
      // the client will send the first page to the server, and the server will scrape that page
      // the server will then send the next page to the client, and the client will send the next page to the server
      // and so on and so forth
    }),

  fetchNamesAndUrlsForPage: publicProcedure
    .input(z.object({
      currentPage: z.number(),
      pageUrl: z.string().url(),
    }))
    .query(async ({ input }) => {
      const { pageUrl, currentPage } = input;
      // this will scrape the and return the names and urls for the page, and the next cursor if there is one

      const namesAndUrls = await getNamesAndUrls(pageUrl);
      
      return {
        namesAndUrls,
        nextPage: currentPage + 1,
      };
      // client will now have the names and urls for the page which it can save in the state for progress
      // client will then send the next page to the server, and the server will scrape that page
    }),

  fetchDataForPages: publicProcedure
    .input(z.object({
      urls: z.object({
        url: z.string().url(),
        name: z.string(),
      }).array(),
      currentDataPage: z.number(),
      // jobId: z.string(),
    }))
    // .query(async ({ input }) => {
    .query(async ({ input }) => {
      const { urls, currentDataPage } = input;
      
      const data = await getDataFromProductPage(urls, "");
    
      return {
        data,
        nextPage: currentDataPage + 1,
      };
    }),

  // this is for creating the job, so we can track the progress
  scrapePictoremGallery: publicProcedure
    .input(z.object({ 
      url: z.string().url(),
      jobId: z.string(),
    }))
    .mutation(({ input }) => {
      const { url, jobId } = input;

      console.log("Creating job.");
      createJob(url, jobId);

      // console.log("Starting scraping process.");
      // const { data, pages } = await scrapePictorem(url, jobId);

      // remove job from jobs list
      deleteJob(jobId);

      // return the data and pages
      return true;
      // return {
      //   data,
      //   pages,
      // } as {
      //   data: ScrapeResult[];
      //   pages: number;
      // };
    }),
});
