import { api } from "~/utils/api";

type useGetProgressProps = {
    jobId: string;
    scrapePending: boolean;
    setProgress: (progress: number) => void;
    setMaxProgress: (maxProgress: number) => void;
}

export default function useGetProgress({jobId, scrapePending, setProgress, setMaxProgress}: useGetProgressProps) {
  // api.scraper.getProgress.useQuery({jobId}, {
  //   enabled: scrapePending,
  //   refetchInterval: 500,
  //   onSuccess: (data) => {
  //     setProgress(data.progress);
  //     setMaxProgress(data.maxProgress);
  //   }
  // });
  const subscription = api.scraper.getProgress.useSubscription({jobId}, {
    enabled: scrapePending,

    onData: (data: { progress: number; maxProgress: number }) => {
      console.log(data);
      setProgress(data.progress);
      setMaxProgress(data.maxProgress);
    },
    onError: (error) => {
      console.log("Subscription error" + error.message);
    }
  });
  
  return subscription;
}