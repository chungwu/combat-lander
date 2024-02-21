import { MONO } from "@/fonts";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { GoogleAnalytics } from "@next/third-parties/google";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${MONO.style.fontFamily}
        }
      `}</style>
      <Head>
        <title>Combat Lander</title>
      </Head>
      <div className={`app dark ${MONO.variable}`}>
        <Component {...pageProps} />
      </div>
      {process.env.NEXT_GOOGLE_ANALYTICS_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_GOOGLE_ANALYTICS_ID} />
      )}
    </>
  );
}
