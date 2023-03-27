const jobs = new Map() as Map<
  string,
  {
    jobId: string;
    progress: number;
    maxProgress: number;
    url: string;
  }
>;
  
const fetchJob = (jobId: string) => {
  // fetch job index of jobId
  // better way of doing this?
  return jobs.get(jobId);
};
  
const updateJob = (jobId: string, progress: number, maxProgress: number) => {
  // update job index of jobId and data that has the progress
  jobs.set(jobId, {
    jobId,
    progress,
    maxProgress,
    url: jobs.get(jobId)?.url as string,
  });
};

const deleteJob = (jobId: string) => {
  // delete job index of jobId
  jobs.delete(jobId);
};
  
const createJob = (url: string, jobId: string) => {
  // create job index of jobId and data that has the progress and url
  jobs.set(jobId, {
    jobId,
    progress: 0,
    maxProgress: 0,
    url,
  });
};

const getAllJobs = () => {
  return jobs;
};

export { fetchJob, updateJob, createJob, deleteJob, getAllJobs };
