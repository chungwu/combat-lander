import { MONO } from "@/fonts";
import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${MONO.style.fontFamily}
        }
      `}</style>
      <div className="app dark">
        <Component {...pageProps} />
      </div>
    </>
  );
}
