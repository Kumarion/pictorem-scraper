import Head from "next/head";
import { useState } from "react";
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
type SubmitProperties = {
  url: string;
};
type ExportedData = RouterOutputs["scraper"]["scrapePictoremGallery"];

const pusher = new Pusher(env.NEXT_PUBLIC_PUSHER_APP_KEY, {
  cluster: "us2",
});

function descriptionFixer(str: string) {
  // gets rid of all whitespace, and then puts spaces between words
  return str.replace(/\s+/g, " ").trim();
}

const exportToCSV  = (d: ExportedData) => {
  // Transform the data into a format that can be exported to CSV
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
  for (const { name, tagId, images, link, description } of d.data) {
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
  for (const { images } of data.data) {
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

const Home: NextPage = () => {
  const [url, setUrl] = useState<string>("");
  const [startTime, setStartTime] = useState<number>(0);
  const [timeTook, setTimeTook] = useState<number>(0);
  const [jsonData, setJsonData] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [maxProgress, setMaxProgress] = useState<number>(0);
  const [jobId, setJobId] = useState<string>("");
  const [data, setData] = useState<ExportedData>({
    data: [],
    pages: 0,
  });

  // use scraper query
  const { isLoading: scrapePending, mutate: scrape } = api.scraper.scrapePictoremGallery.useMutation({
    onSuccess: (data) => {
      setData(data);
      setUrl("");
      setValue("url", "");
      // get the time it took in seconds
      setTimeTook((Date.now() - startTime) / 1000);
      toast("Scraping completed", "success");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast(error.message, "error");
        setUrl("");
        setValue("url", "");
      }
    }
  });
  
  // this is for retrieving the progress on the server
  const channel = pusher.subscribe(jobId);
  channel.bind("jobProgress", (data: {progress: number, maxProgress: number}) => {
    setProgress(data.progress);
    setMaxProgress(data.maxProgress);
  });

  const { register, handleSubmit, setValue, setError, formState: { errors } } = useForm<SubmitProperties>();
  const submit: SubmitHandler<SubmitProperties> = (data) => {
    // start the timer
    const start = Date.now();
    setStartTime(start);
    setUrl(data.url);

    const generatedId = generateJobId();
    const generatedJobId = `${generatedId}`;
    setJobId(generatedJobId);
    scrape({url: data.url, jobId: generatedJobId});
  };
  const reset = () => {
    setUrl("");
    setData({
      data: [],
      pages: 0,
    });
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
                    className={`btn btn-primary btn-lg` + `${scrapePending && url != "" ? " loading" : ""}`}
                    disabled={scrapePending}
                  >
                    {!scrapePending && 
                    <FaGitkraken 
                      fontSize={25} 
                      className="mr-2" 
                    />}
                    {scrapePending && url != "" ? "Working..." : "Scrape"}
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
            {data && data.data.length > 0 && (
              <div className="flex flex-col items-center gap-3 mt-16">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-lg font-medium text-white">
                    {`Total items scraped: ${formatNumber(data.data.length)}`}
                  </p>
                  <p className="text-lg font-medium text-white">
                    {`Total images scraped: ${formatNumber(getTotalImages(data))}`} 
                  </p>
                  <p>
                    {`File size: ${getFileSize(getTotalImages(data))}`}
                  </p>
                  <p>
                    Scraped {data.pages} page{data.pages > 1 ? "s" : ""}, operation took {secondsToHms(timeTook)}.
                  </p>
                </div>

                <button
                  onClick={() => exportToCSV(data)}
                  className="btn btn-primary btn-lg mt-3 animate-pulse"
                >
                  <BsCloudDownloadFill className="inline-block w-5 h-5 mr-2" />
                  Download your CSV file
                </button>
              </div>
            )}            
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mb-10 mt-14">
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