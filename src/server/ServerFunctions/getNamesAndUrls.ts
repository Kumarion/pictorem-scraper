import fetch from "node-fetch";
import { load } from "cheerio";

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

export default getNamesAndUrls;