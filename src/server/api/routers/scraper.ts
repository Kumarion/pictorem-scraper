import { z } from "zod";
import { load } from "cheerio";
import fetch from "node-fetch";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";

type ScrapeResult = {
  name: string; 
  tagId: string; 
  images: string[]; 
  link: string; 
  description: string
}

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
  
  const maxNumber = 1000;
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

    console.log("Here stil");

    namesAndUrls.forEach((el) => {
      validUrlsWithNames.push({
        name: el.name,
        url: el.url,
      });
    });

    pagesIterated++;
  }

  return {
    allPagesWithUrlsAndNames: validUrlsWithNames,
    pagesIterated,
  };
}

async function getNamesAndUrls(urls: string | string[]): Promise<{ name: string; url: string }[]> {
  return new Promise((resolve, reject) => {
    const namesOfProductsWithUrls: { name: string; url: string }[] = [];
    const promises = [] as Promise<{ name: string; url: string }[]>[];

    if (typeof urls === "string") {
      urls = [urls];
    }

    // loop through all the urls and get the names and urls
    let i = 0;
    for (i; i < urls.length; i++) {
      const url = urls[i] as string;
      const promise = new Promise<{ name: string; url: string }[]>((resolve2, reject2) => {
        fetch(url)
          .then((res) => res.text())
          .then((body) => {
            console.log("Retreived body for: ", url);
            const $ = load(body);
            const galleryArea = $(".gallery-area");
            const galleryContainer = $(galleryArea).find(".container");
            const hgSection = $(galleryContainer).find(".hg_section");
            const hgSectionContainer = $(hgSection).find(".container");
            const hgSectionRow = $(hgSectionContainer).find(".row");
            
            // Works for a profile page
            if (!$(galleryArea).hasClass(".entry-listing")) {
              const entryListing = $(galleryArea).find("#entry-listing").find("article");
              entryListing.each((i, el) => {
                const entryContent = $(el).find(".entry-content");
                const aElement = $(entryContent).find("a");
                const imgElement = $(entryContent).find(".img-default");

                // get href
                const hrefForProduct = $(aElement).attr("href");
                const nameForProduct = $(imgElement).attr("title");
                if (hrefForProduct === undefined || nameForProduct === undefined) {
                  return;
                }
      
                // prevent duplicates
                if (!namesOfProductsWithUrls.some((el) => el.name === nameForProduct)) {
                  namesOfProductsWithUrls.push({ name: nameForProduct, url: hrefForProduct });
                }
              });
            }

            // Another profile page
            if ($(galleryContainer).has(".grid")) {
              const grid = $(galleryContainer).find(".grid");
              const theContainer = $(grid).find(".container");
              const theRow = $(theContainer).find(".row");
              const masonry = $(theRow).find(".masonry").find(".itemmasonry");

              masonry.each((i, el) => {
                const div = $(el).find("div");
                const aElement = $(div).find("a").first();

                // get href
                const hrefForProduct = $(aElement).attr("href");
                // we need to get the name from the href (because the name is not in the img element)
                const nameForProduct = $(aElement).attr("href")?.split("/").pop()?.replace(".html", "");
                if (hrefForProduct === undefined || nameForProduct === undefined) {
                  return;
                }
      
                // prevent duplicates
                if (!namesOfProductsWithUrls.some((el) => el.name === nameForProduct)) {
                  namesOfProductsWithUrls.push({ name: nameForProduct, url: hrefForProduct });
                }
              });
            }

            // Another type of profile page
            const mainGrid = $(".grid");
            if (mainGrid.length > 0) {
              const div = $(mainGrid).find("div");
              const divDiv = $(div).find("div");
              $(divDiv).each((i, el) => {
                // const divA = $(el).find("div");
                const aElement = $(el).find("a").first();

                // get href
                const hrefForProduct = $(aElement).attr("href");
                // we need to get the name from the href (because the name is not in the img element)
                const nameForProduct = $(aElement).attr("href")?.split("/").pop()?.replace(".html", "");
                if (hrefForProduct === undefined || nameForProduct === undefined) {
                  return;
                }
      
                // prevent duplicates
                if (!namesOfProductsWithUrls.some((el) => el.name === nameForProduct)) {
                  console.log("nameForProduct: ", nameForProduct);
                  namesOfProductsWithUrls.push({ name: nameForProduct, url: hrefForProduct });
                }
              });
            }

            // Works for a gallery page
            const hgSectionCol = $(hgSectionRow).find("div");
            if (hgSectionCol) {
              hgSectionCol.each((i, el) => {
                const aElement = $(el).find(".gridPhotoGallery__link");
                // get href
                const hrefForProduct = $(aElement).attr("href");
                const nameForProduct = $(aElement).attr("title");
                if (hrefForProduct === undefined || nameForProduct === undefined) {
                  return;
                }

                // prevent duplicates
                if (!namesOfProductsWithUrls.some((el) => el.name === nameForProduct)) {
                  namesOfProductsWithUrls.push({ name: nameForProduct, url: hrefForProduct });
                }
              });
            }

            resolve2(namesOfProductsWithUrls);
          })
          .catch((err) => {
            console.error("Error while getting names and urls: ", err);
            reject2(err);
          });
      });

      promises.push(promise);
    }

    // console.log("Ran through all the urls " + i.toString() + " times");

    const allPromises = Promise.all(promises);
    allPromises.then((data) => {
      const allNamesAndUrls = [] as { name: string; url: string }[];
      data.forEach((el) => {
        el.forEach((el2) => {
          allNamesAndUrls.push(el2);
        });
      });

      resolve(allNamesAndUrls);
    }).catch((err) => {
      reject(err);
    });
  });
}

async function getDataFromProductPage(urls: { name: string; url: string }[]) {
  // Loop through the urls and get the data via scraping
  const promises = urls.map(async(urlResolving) => {
    const data = [] as ScrapeResult[];

    return new Promise((resolve, reject) => {
      fetch(urlResolving.url)
        .then((res) => res.text())
        .then((body) => {
          console.log("[getting page data] Retreived body for: ", urlResolving.url);
          const $ = load(body);
          const container = $(".container");
          const row = $(container).find(".row");

          // there will be 3 divs, first is carousel images, second is main image, third is description/name/product tag id
          const carouselImages = $(row).find("ol").find("li");
          const aCarouselImages = $(row).find("ol").find("a");
          const imagesForProduct = [] as string[];

          // Carousel images for product
          // We do it for list items and a tags because some products have a list item and some have an a tag
          carouselImages.each((i, ee) => {
            // if the name is not in the data array, add it
            // if the name is in the data array, add the image to the images array
            const image = $(ee).find("img").attr("src");
            if (image === undefined) {
              return;
            }
            let newImage = image;
            // some image urls might have the word "small" in them, remove it completely
            if (image.includes("small")) {
              // console.log("Found small in image url, replacing it with nothing to achieve the full image ", image);
              newImage = image.replace("small", "");
            }
            imagesForProduct.push(newImage);
          });
          aCarouselImages.each((i, ee) => {
            // if the name is not in the data array, add it
            // if the name is in the data array, add the image to the images array
            const image = $(ee).find("img").attr("src");
            if (image === undefined) {
              return;
            }
            let newImage = image;
            // some image urls might have the word "small" in them, remove it completely
            if (image.includes("small")) {
              // console.log("Found small in image url, replacing it with nothing to achieve the full image ", image);
              newImage = image.replace("small", "");
            }
            imagesForProduct.push(newImage);
          });

          let specialImage = "";
          // we need to get that fancy image from the bottom of the page
          const hgSection = $("section");
          if (hgSection.length > 0) {
            const hgSectionContainer = $(hgSection).find(".container");
            if (hgSectionContainer.length > 0) {
              const hgSectionContanierRow = $(hgSectionContainer).find(".row");
              if (hgSectionContanierRow.length > 0) {
                const theDiv = $(hgSectionContanierRow).find("div");
                const tabbable = $(theDiv).find(".tabbable");
                if (tabbable.length > 0) {
                  const tabContent = $(tabbable).find(".tab-content");
                  const firstTabData = $(tabContent).first();

                  // get second div in firstTabData
                  const secondDiv = $(firstTabData).find(".tx2s");
                  const aa = $(secondDiv).find(".fancybox-effects-a");
                  const img = $(aa).find("img");
                  const src = $(img).attr("src");
                  // console.log(src);
                  if (src !== undefined) {
                    specialImage = src;
                  }
                }
              }
            }
          }

          const thirdItem = $(row).find(".fadein2s");
          const div = $(thirdItem).find("div");
          const second = $(div).find("div").last();
          const font = $(second).find("font");
          const gotNumber = font.text().match(/\d+/);
          if (gotNumber === null) {
            return;
          }
          const newFormed = `#${gotNumber[0]}`;

          // get description if there is one
          // let description = "";
          // const text = $(row).find("div").last().find("#text").last();
          // console.log(text.text());
          let description = "";
          if ($(".container-full").length > 0) {
            const containerFullContainer = $(".container-full").find(".container");
            const containerFullContainerRow = $(containerFullContainer).find(".row");
            const containerFullContainerRowCol = $(containerFullContainerRow).children().eq(1);

            if ($(containerFullContainerRowCol).length > 0) {
              const font = $(containerFullContainerRowCol).find("font").last();
              // console.log(font.text());
              const text = $(font).text();
              if (text !== undefined) {
                description = text;
              }
            }
          }

          // remove anything after html, some urls have spaces too, so lets be safe and remove everything after .html
          const newUrl = urlResolving.url.split(".html")[0] as string;
          console.log(newUrl);

          // append the special image to the images array
          if (specialImage !== "") {
            imagesForProduct.push(specialImage);
          }

          data.push({
            name: urlResolving.name,
            tagId: newFormed,
            images: imagesForProduct,
            // make sure to remove the .html and anything after that, we only want the base url because its quicker to scrape
            link: newUrl,
            description,
          });

          resolve(data);
          console.log("[getting page data] Resolved data for: ", urlResolving.url);
        })
        .catch((err) => {
          console.error("[getting page data] Error: ", err);
          reject(err);
        });
    });
  });

  const allPromises = Promise.all(promises);
  const data = await allPromises;
  console.log("All promises have been resolved for data");
  return data.flat();
}

async function scrapePictoremGallery(url: string) {
  // if we find ?records= in the url, we just need to scrape that individual page
  if (url.includes("?records=")) {
    console.log("Scraping individual page!");
    
    const namesAndUrls = await getNamesAndUrls(url);
    const data = await getDataFromProductPage(namesAndUrls);
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
  const data = await getDataFromProductPage(namesAndUrls);
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
      const theData = d as ScrapeResult;
      if (theData.images.length <= 4) {
        console.log("Product with less than 4 images: ", theData.name, theData.link);
      }
    });
  }

  console.log("Done. Performed all checks.");

  return {
    data,
    pages: pagesIterated,
  };
}

export const scraperRouter = createTRPCRouter({
  scrapePictoremGallery: publicProcedure
    .input(z.object({ 
      url: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const { url } = input;

      console.log("Starting process.");
      const { data, pages } = await scrapePictoremGallery(url);

      return {
        data,
        pages,
      } as {
        data: ScrapeResult[];
        pages: number;
      };
    }),

  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.example.findMany();
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
