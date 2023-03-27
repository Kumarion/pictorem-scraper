import getNamesAndUrls from "./getNamesAndUrls";  
import getDataFromProductPage from "./getDataFromProductPage";
import getAllPagesWithUrlsAndNames from "./getAllPagesWithUrlsAndNames";
import { TRPCError } from "@trpc/server";

async function scrapePictorem(url: string, jobId: string) {
  // if we find ?records= in the url, we just need to scrape that individual page
  if (url.includes("?records=")) {
    console.log("Scraping individual page!");
      
    const namesAndUrls = await getNamesAndUrls(url);
    const data = await getDataFromProductPage(namesAndUrls, jobId);
    return {
      data,
      pages: 1,
    };
  }
  
  // run if records was not specified
  const { allPagesWithUrlsAndNames, pagesIterated } = await getAllPagesWithUrlsAndNames(url);
  console.log("All pages with urls and names: ", allPagesWithUrlsAndNames);
  
  // append the additional pages to the base url
  // const urls = [url, ...additionalPages];
  // const namesAndUrlsBeforeValidation = await getNamesAndUrls(urls);
  
  // one more validation removing duplicates
  const namesAndUrls = allPagesWithUrlsAndNames.filter((thing, index, self) =>
    index === self.findIndex((t) => (
      t.name === thing.name && t.url === thing.url
    ))
  );
  
  // make sure theres only one, just for testing
  // const namesAndUrls2 = namesAndUrls.slice(0, 1);
  // console.log("Names and urls: ", namesAndUrls);
  
  console.log("Getting data from product pages...");
  const data = await getDataFromProductPage(namesAndUrls, jobId);
  if (data.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No data found, or there is no data to scrape",
    });
  }
  
  console.log("Successfully scraped data from all urls");
  // console.log("Data from all urls: ", data);
  
  // report any with 4 or less images
  // tuscany house reported less than 0, but it seems to be a bug with the website, or the images the uploader uploaded
  if (data) {
    data.map((d) => {
      if (d.images.length <= 4) {
        console.log("Product with less than 4 images: ", d.name, d.link);
      }
    });
  }
  
  console.log("Done. Performed all checks.");
  
  return {
    data,
    pages: pagesIterated,
  };
}

export default scrapePictorem;