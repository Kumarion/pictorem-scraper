import fetch from "node-fetch";
import { load } from "cheerio";
import { updateJob } from "./jobsHandler";

import type { ScrapeResult } from "~/types";
import SendJobConsoleMessage from "./scrapeJobConsole";

async function getDataFromProductPage(urls: { name: string; url: string }[], jobId: string) {
  // Loop through the urls and get the data via scraping
  let promisesResolved = 0;
  const promises = [] as Promise<ScrapeResult[]>[];

  urls.map((urlResolving) => {
    const data = [] as ScrapeResult[];

    // append promises to the table to run in parallel and wait for them to resolve at the end
    // this will be much better because we can run multiple requests at once
    promises.push(
      new Promise((resolve, reject) => {
        fetch(urlResolving.url)
          .then((res) => res.text())
          .then((body) => {
            console.log("[getting page data] Retreived body for: ", urlResolving.url);
            SendJobConsoleMessage(jobId, `[Getting page data] Retreived body for: ${urlResolving.url}`);
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
            SendJobConsoleMessage(jobId, `[Getting page data] Resolved data for: ${urlResolving.url}`);
            
            promisesResolved += 1;
            console.log(`Promises resolved: ${promisesResolved}. Urls left: ${urls.length - promisesResolved}`);
            // SendJobConsoleMessage(jobId, `Promises resolved: ${promisesResolved}. Urls left: ${urls.length - promisesResolved}`);

            // update the job with the new progress, and max progress
            updateJob(jobId, promisesResolved, urls.length);
          })
          .catch((err) => {
            console.error("[getting page data] Error: ", err);
            reject(err);
          });
      })
    );
  });
  
  const allPromises = Promise.all(promises);
  const data = await allPromises;
  console.log("All promises have been resolved for data");
  return data.flat();
}

export default getDataFromProductPage;