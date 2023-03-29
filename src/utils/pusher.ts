import pusher from "pusher";
import { env } from "~/env.mjs";

const consolePusher = new pusher({
  appId: env.PUSHER_APP_ID,
  key: env.NEXT_PUBLIC_PUSHER_APP_KEY,
  secret: env.PUSHER_SECRET,
  cluster: "us2",
  useTLS: true,
});

export { consolePusher };