import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ToastContainer } from "react-toastify";
import toast from "~/helpers/toast";
import { ExportToCsv } from "export-to-csv";
import { api } from "~/utils/api";
import { motion } from "framer-motion";
import { BsCloudDownloadFill } from "react-icons/bs";
import { FaGitkraken } from "react-icons/fa";
import { BiReset } from "react-icons/bi";
import formatNumber from "~/helpers/numberHelper";
import { nanoid } from "nanoid";
import csv from "csvtojson";
import Pusher from "pusher-js";
import { env } from "~/env.mjs";

import type { SubmitHandler } from "react-hook-form";
import type { RouterOutputs } from "~/utils/api";
import type { NextPage } from "next";
import type { ScrapeResult } from "~/types";
type SubmitProperties = {
  url: string;
  pages: number;
};
type ExportedData = RouterOutputs["scraper"]["fetchDataForPages"]["data"];

let subscribed = false;
const pusher = new Pusher(env.NEXT_PUBLIC_PUSHER_APP_KEY, {
  cluster: "us2",
});

function descriptionFixer(str: string) {
  // gets rid of all whitespace, and then puts spaces between words
  return str.replace(/\s+/g, " ").trim();
}

const exportToCSV  = (d: ExportedData) => {
//   // Transform the data into a format that can be exported to CSV
  const dataToExport = [] as {
    name: string;
    tagId: string;
    imageUrl: string;
    link: string;
    description: string;
  }[];

  // for (const { name, tagId, images, link } of d.data) {
  //   images.forEach((imageUrl, index) => {
  //     const row = {
  //       name: index === 0 ? name : '',
  //       tagId: index === 0 ? tagId : '',
  //       imageUrl,
  //       link: index === 0 ? link : ''
  //     };
  //     dataToExport.push(row);
  //   });
  // }

  // imageUrl is a string with all images separated by a comma
  for (const { name, tagId, images, link, description } of d) {
    // make sure its in the same order as this (name, description, tagId, imageUrl, product_link)
    const row = {
      name,
      description: descriptionFixer(description),
      tagId,
      imageUrl: images.join(","),
      link,
    };
    dataToExport.push(row);
  }

  // Set the CSV export options
  const options = {
    fieldSeparator: ",",
    quoteStrings: '"',
    decimalSeparator: ".",
    showLabels: true, 
    showTitle: true,
    title: "Pictorem Scraper Data",
    useTextFile: false,
    useBom: true,
    useKeysAsHeaders: false,
    filename: "pictorem-scraper-data",
    headers: ['Name', 'Description', 'Tag #', 'Image URL', 'Product Link']
  };

  // Create a new instance of the ExportToCsv class
  const csvExporter = new ExportToCsv(options);

  // Generate and download the CSV file
  csvExporter.generateCsv(dataToExport);
};

const getTotalImages = (data: ExportedData) => {
  let total = 0;
  for (const { images } of data) {
    total += images.length;
  }
  return total;
};

const getFileSize = (totalImages: number) => {
  // could be KB, MB, GB
  const size = totalImages * 0.5;
  if (size < 1000) {
    return `${size.toFixed(2)} KB`;
  }
  if (size < 1000000) {
    return `${(size / 1000).toFixed(2)} MB`;
  }
  return `${(size / 1000000).toFixed(2)} GB`;
};

const secondsToHms = (d: number) => {
  if (d < 60) {
    return `${d} seconds`;
  }

  if (d >= 60 && d < 3600) {
    return `${Math.floor(d / 60)} minutes`;
  }

  if (d >= 3600) {
    return `${Math.floor(d / 3600)} hours`;
  }
};

const generateJobId = () => {
  return nanoid(15);
};

type scrapedNamesAndUrls = RouterOutputs["scraper"]["fetchNamesAndUrlsForPage"]["namesAndUrls"];
type dataToScrape = ScrapeResult;

const Home: NextPage = () => {
  const { register, handleSubmit, setValue, setError, watch, formState: { errors } } = useForm<SubmitProperties>();

  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);

  const [url, setUrl] = useState<string>("");
  const [startTime, setStartTime] = useState<number>(0);
  const [timeTook, setTimeTook] = useState<number>(0);
  const [jsonData, setJsonData] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [maxProgress, setMaxProgress] = useState<number>(0);
  const [jobId, setJobId] = useState<string>("");
  const [pagesDone, setPagesDone] = useState<boolean>(false);
  const [scraping, setScraping] = useState<boolean>(false);

  useEffect(() => {
    if (!subscribed && jobId) {
      const channel = pusher.subscribe(jobId);
      subscribed = true;
      channel.bind("job-console", ({ message }: {message: string}) => {
        // append message (no duplicates)
        setConsoleMessages((messages) => [...messages, message]);
      });
    }
  }, [jobId]);

  // use scraper query
  const { mutate: scrape } = api.scraper.scrapePictoremGallery.useMutation({
    onSuccess: (data) => {
      // get the time it took in seconds
      // setTimeTook((Date.now() - startTime) / 1000);
      setScraping(true);

      // formulate all the links and pages to scrape so the server knows where to get the products from
      if (!data.url.includes("?records=")) {
        // If a records query is present in the url, just use that
        // otherwise, we will generate the pages
        for (let i = 1; i <= parseInt(data.pages); i++) {
          const pageUrl = `${data.url}?records=${i}`;
          setPagesGot((pagesGot) => [...pagesGot, pageUrl]);
        }
      } else {
        // just add the url to the pages
        setPagesGot((pagesGot) => [...pagesGot, data.url]);
      }

      // we are done with the pages
      setPagesDone(true);

      // toast("Scraping completed", "success");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast(error.message, "error");
        setUrl("");
        setValue("url", "");
      }
    }
  });

  // this will be the pages that are scraped in a state
  const [pagesGot, setPagesGot] = useState<string[]>([]);


  // this will be the names and urls returned from each page
  const [namesAndUrlsGot, setNamesAndUrlsGot] = useState<scrapedNamesAndUrls>([]);
  const [namesAndUrlsDone, setNamesAndUrlsDone] = useState<boolean>(false);
  const [currentNamesAndUrlsPage, setCurrentNamesAndUrlsPage] = useState<number>(0);
  const {  } = api.scraper.fetchNamesAndUrlsForPage.useQuery({
    pageUrl: pagesGot[currentNamesAndUrlsPage] as string,
    currentPage: currentNamesAndUrlsPage,
  }, {
    enabled: pagesDone && !namesAndUrlsDone,
    onSuccess: (data) => {
      // set the names and urls to the data
      // append to the names and urls
      setNamesAndUrlsGot(
        namesAndUrlsGot.concat(data.namesAndUrls)
      );

      if (data.nextPage >= pagesGot.length) {
        // we are done
        setNamesAndUrlsDone(true);
        return;
      }

      setCurrentNamesAndUrlsPage(data.nextPage);
    },
  });
  
  // we will batch up the namesAndUrlsGot into 10 and send it to the server in batches
  // this will be the names and urls that are sent to the server
  const [dataGot, setDataGot] = useState<dataToScrape[]>([]);
  const [dataGotDone, setDataGotDone] = useState<boolean>(false);
  const [currentDataPage, setCurrentDataPage] = useState<number>(0);
  const {  } = api.scraper.fetchDataForPages.useQuery({
    urls: namesAndUrlsGot.slice(currentDataPage * 10, (currentDataPage + 1) * 10).map((item) => {
      return item;
    }),
    currentDataPage,
    jobId,
  }, {
    enabled: namesAndUrlsDone && !dataGotDone,
    onSuccess: (data) => {
      // set the names and urls to the data
      // append to the names and urls
      setDataGot(
        dataGot.concat(data.data)
      );

      console.log(dataGot);
      console.log(dataGot.length, data.nextPage);

      // if its the last page, then we are done
      // there wlil be X namesAndUrlsGot and there will be roughly 10 dataGot per page
      // we need to 
      const totalExpectedPages = Math.ceil(namesAndUrlsGot.length / 10);

      // we expect X pages to be scraped, so if the next page is greater than that, then we are done
      if (data.nextPage >= totalExpectedPages) {
        setTimeTook((Date.now() - startTime) / 1000);
        toast("Scraping completed", "success");
        setDataGotDone(true);
        setScraping(false);
        return;
      }

      setCurrentDataPage(data.nextPage);
    },
  });

  const submit: SubmitHandler<SubmitProperties> = (data) => {
    // reset the state
    reset();

    // start the timer
    const start = Date.now();
    setStartTime(start);
    setUrl(data.url);

    const generatedId = generateJobId();
    const generatedJobId = `${generatedId}`;
    setJobId(generatedJobId);
    scrape({url: data.url, jobId: generatedJobId, pages: data.pages.toString()});
  };
  const reset = () => {
    setUrl("");
    setJsonData("");
    setPagesGot([]);
    setPagesDone(false);
    setNamesAndUrlsGot([]);
    setNamesAndUrlsDone(false);
    setDataGot([]);
    setDataGotDone(false);
    setCurrentDataPage(0);
    setCurrentNamesAndUrlsPage(0);
    setScraping(false);
    setStartTime(0);
    setValue("pages", 1);
    setTimeTook(0);
    setJobId("");
    setValue("url", "");
    setError("url", { type: "manual", message: "" });
    setProgress(0);
    setMaxProgress(0);
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const data = await csv().fromString(e.target.result as string);
          setJsonData(JSON.stringify(data));
        }
      };
      reader.readAsText(file as Blob);
    }
  };
  const getCurrentPageScraping = () => {
    // get total amount of pages, then get the current page based on the currentDataPage
    const totalExpectedPages = Math.ceil(namesAndUrlsGot.length / 10);
    return `${currentDataPage + 1} / ${totalExpectedPages}`;
  };

  const consoleRef = useRef() as React.MutableRefObject<HTMLPreElement>;

  useEffect(() => {
    if (!consoleRef.current) return;

    const timer = setTimeout(() => {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }, 100);

    return () => clearTimeout(timer);
  }, [consoleMessages]);

  return (
    <>
      <Head>
        <title>Pictorem Scraper</title>
        <meta
          name="description"
          content="Pictorem scraper for downloading images"
        />
        <link
          rel="icon"
          href="/favicon.ico"
        />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1d1d1d] to-[#000000]">
        <ToastContainer />

        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 max-w-screen-7xl">
          <div className="flex flex-col items-center gap-4">
            <p className="text-3xl font-extrabold tracking-tight text-white sm:text-[4rem]">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0 }}
              >
                Pictorem Scraper
              </motion.span>
            </p>
          </div>
          <div className="justify-center w-full">
            <form 
              onSubmit={handleSubmit(submit)}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex flex-col items-center gap-2 w-full">
                <label
                  htmlFor="url"
                  className="block text-lg font-medium text-white"
                >
                  Paste the URL of the user from the Pictorem website (works on /gallery and /profile)
                </label>
                <label
                  htmlFor="url"
                  className="block text-xs font-medium text-white"
                >
                  (e.g. https://pictorem.com/gallery/username) 
                  (e.g https://pictorem.com/profile/username)
                  (e.g https://pictorem.com/gallery?records=1)
                </label>
                <label
                  htmlFor="url"
                  className="block text-xs font-medium text-white"
                >
                  Tested with over 80 pages, takes a good 5-8 minutes though.
                </label>

                {
                  errors && errors.url && errors.url?.message != "" &&
                  <span className="text-red-500 text-sm">
                    {errors.url.message as string}
                  </span>
                }

                <input 
                  type="text" 
                  placeholder="Type here (e.g. https://pictorem.com/gallery/username)" 
                  autoComplete="off"
                  {...register("url", { 
                    required: true,
                    pattern: {
                      // value: /^https:\/\/pictorem\.com\/gallery\/[a-zA-Z0-9._-]+$/,
                      // valid https link
                      value: /^https?:\/\/[^\s$.?#].[^\s]*$/,
                      message: "Invalid URL",
                    },
                    value: url,
                  })}
                  className="input input-bordsered w-full max-w-xl" 
                />

                <div className="flex flex-col items-center mt-5 gap-2 w-1/4">
                  <label
                    htmlFor="url"
                    className="block text-sm text-center font-medium text-white"
                  >
                    Pages to scrape: {watch("pages") || 1} (leave at 1 if you just want to scrape a certain page)
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    defaultValue={1}
                    {...register("pages", {
                      required: true,
                      value: 1,
                      min: 1,
                    })}
                    className="range range-success" 
                  />
                </div>
              </div>

              {progress > 0 &&
                <p className="text-white text-center">
                  {progress} items scraped out of {maxProgress} items
                </p>  
              }

              <div className="flex flex-row justify-center gap-4 w-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    type="submit"
                    className={`btn btn-primary btn-lg` + `${scraping && url != "" ? " loading" : ""}`}
                    disabled={scraping}
                  >
                    {!scraping && 
                    <FaGitkraken 
                      fontSize={25} 
                      className="mr-2" 
                    />}
                    {scraping && url != "" ? "Working..." : "Scrape"}
                  </button>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="btn btn-primary btn-lg"
                  >
                    <BiReset 
                      fontSize={25} 
                      className="mr-2" 
                    />
                    Reset
                  </button>
                </motion.div>
              </div>

            </form>

            {/* Final result to download csv */}
            {dataGot && dataGot.length > 0 && (
              <div className="flex flex-col items-center gap-6 mt-16 w-full">
                <div 
                  className="flex mockup-code rounded-lg bg-base-200 text-primary-content max-w-5xl w-full"
                >
                  <div className="mt-6 w-full">
                    <pre 
                      className="text-gray-500 pt-7 h-screen overflow-y-visible overflow-x-hidden"
                      ref={consoleRef}
                    >
                      <code className="text-sm">
                        {consoleMessages.map((message, index) => {
                          return (
                            <pre 
                              key={index}
                              data-prefix=">" 
                              className="text-success"
                            >
                              <code>
                                {message}
                              </code>
                            </pre> 
                          );
                        })}
                      </code>
                    </pre> 
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <p>
                    Current batch of page scraping: {getCurrentPageScraping()}
                  </p>
                  <progress 
                    className="progress progress-success w-56" 
                    value={currentDataPage + 1}
                    max={Math.ceil(namesAndUrlsGot.length / 10)}
                  ></progress>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <p className="text-lg font-medium text-white">
                    {`Total items scraped: ${formatNumber(dataGot.length)}`}
                  </p>
                  <p className="text-lg font-medium text-white">
                    {`Total images scraped: ${formatNumber(getTotalImages(dataGot))}`} 
                  </p>
                  <p>
                    {`File size: ${getFileSize(getTotalImages(dataGot))}`}
                  </p>
                  <p>
                    {/* Scraped {dataGot.pages} page{dataGot.pages > 1 ? "s" : ""}, operation took {secondsToHms(timeTook)}. */}
                    {dataGotDone ? "Scraped" : "Scraping"} {pagesGot.length} page{pagesGot.length > 1 ? "s" : ""}, operation took {timeTook == 0 ? "(in progress)" : secondsToHms(timeTook)}.
                  </p>
                </div>

                {dataGotDone && (
                  <button
                    onClick={() => exportToCSV(dataGot)}
                    className="btn btn-primary btn-lg mt-3 animate-pulse"
                  >
                    <BsCloudDownloadFill className="inline-block w-5 h-5 mr-2" />
                    Download your CSV file
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mb-10 mt-8">
          <span 
            className="text-white text-center"
          >
              Upload your CSV to view the JSON data
          </span>

          <form className="flex flex-row items-center gap-4">
            <input 
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="file-input w-full max-w-md"
            />

            {/* Clear */}
            <button
              type="reset"
              onClick={() => {
                setJsonData("");
              }}
              className="btn btn-primary btn-md"
            >
              <BiReset
                fontSize={25}
                className="mr-2"
              />
                Clear data
            </button>
          </form>

          {jsonData && jsonData != "" && (
            <div className="flex flex-col items-center gap-4 mt-4 w-full">
              <span
                className="text-white text-center"
              >
                  extra: JSON data retrieved from your CSV file
              </span>
                
              <div className="flex flex-col items-center gap-4 w-full">
                <textarea
                  value={jsonData}
                  className="input input-bordsered w-full h-full max-w-6xl"
                  cols={700}
                  rows={200}
                  readOnly
                />
              </div>
            </div>  
          )}
        </div>
      </main>
    </>
  );
};

export default Home;