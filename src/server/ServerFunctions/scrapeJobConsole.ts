import { consolePusher } from "~/utils/pusher";

export default function SendJobConsoleMessage(jobId: string, msg: string) {
  consolePusher.trigger(jobId, "job-console", {
    message: msg,
  }).then(() => {
    //
  }).catch(console.error);
}