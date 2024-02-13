import { ClientOnly } from "@/components/ClientOnly";
import { useRouter } from "next/router";
import React from "react";
import dynamic from "next/dynamic";
import { GetStaticPaths, GetStaticProps } from "next";

const LazyRoom = dynamic(() => import("../components/Room"));

export const getStaticProps: GetStaticProps = (context) => {
  return {
    props: {}
  };
}

export const getStaticPaths: GetStaticPaths = (context) => {
  return {
    paths: [],
    fallback: "blocking"
  };
}

export default function() {
  const roomId = useRouter()?.query?.roomId as string;
  if (!roomId) {
    return null;
  }
  console.log("Rendering lazy room", roomId)
  return <ClientOnly><LazyRoom roomId={roomId} /></ClientOnly>;
}
