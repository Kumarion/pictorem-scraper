import { TRPCError } from "@trpc/server";
import getNamesAndUrls from "./getNamesAndUrls";

async function getAllPagesWithUrlsAndNames(baseUrl: string) {
  // this will keep going up pages ?records=1, ?records=2, ?records=3, etc. until it finds a page that has the same products as the first page
  // this is because the website has a lot of pages that are empty, and we don't want to scrape those
  
  // get the first page
  const startData = await getNamesAndUrls(baseUrl);
  const validUrlsWithNames = [] as { name: string; url: string }[];
  
  // if it fails, we dont want to continue
  if (startData.length === 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get the first page",
    });
  }
    
  let maxNumber = 10;
  const startingNumber = 2;
  let pagesIterated = 1;
  
  // add the first page
  startData.forEach((el) => {
    validUrlsWithNames.push({
      name: el.name,
      url: el.url,
    });
  });
  
  // we need to make it dynamic, so we can get the last page
  for (let i = startingNumber; i < maxNumber; i++) {
    const url = `${baseUrl}?records=${i}`;
    const startName = startData[0]?.name;
    const namesAndUrls = await getNamesAndUrls(url);
  
    // if it fails, we break (no infinite loop)
    if (namesAndUrls.length === 0) {
      break;
    }
  
    // if we find the startName in the namesAndUrls (not ignoring the first one because it's the same) then its invalid
    if (namesAndUrls.some((el) => el.name === startName)) {
      break;
    }
  
    namesAndUrls.forEach((el) => {
      validUrlsWithNames.push({
        name: el.name,
        url: el.url,
      });
    });
  
    // increment the maxNumber
    maxNumber++;
    pagesIterated++;
  }
  
  return {
    allPagesWithUrlsAndNames: validUrlsWithNames,
    pagesIterated,
  };
}

export default getAllPagesWithUrlsAndNames;