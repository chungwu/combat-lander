import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useRouter } from "next/router";
import { nanoid } from "nanoid";
import React from "react";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const router = useRouter();
  React.useLayoutEffect(() => {
    router.push(`/${nanoid()}`);
  }, [router]);
  return null;
}
