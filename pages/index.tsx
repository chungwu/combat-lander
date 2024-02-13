import { useIsomorphicLayoutEffect } from "@/hooks/react-utils";
import { nanoid } from "nanoid";
import { Inter } from "next/font/google";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  useIsomorphicLayoutEffect(() => {
    router.push(`/${nanoid()}`);
  }, [router]);
  return null;
}
