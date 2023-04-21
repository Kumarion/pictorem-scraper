import { type AppType } from "next/app";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { api } from "~/utils/api";
import Footer from "~/components/footer";

import "~/styles/globals.css";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <>
      <SessionProvider session={session}>
        <Component {...pageProps} />
      </SessionProvider>
      <Footer />
    </>
  );
};

// MyApp.getInitialProps = async ({ ctx }) => {
//   return {
//     session: await getSession(ctx),
//   };
// };

export default api.withTRPC(MyApp);
