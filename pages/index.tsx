import { useIsomorphicLayoutEffect } from "@/hooks/react-utils";
import { customAlphabet } from "nanoid";
import { useRouter } from "next/router";

// We don't care that much about collision, so use a small,
// easy to share alphabet
const makeId = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 6);

export default function Home() {
  const router = useRouter();
  useIsomorphicLayoutEffect(() => {
    router.push(`/${makeId()}`);
  }, [router]);
  return null;
}
