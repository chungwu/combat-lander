import { useIsomorphicLayoutEffect } from "@/hooks/react-utils";
import React from "react";

export function ClientOnly(props: { children?: React.ReactNode }) {
  const [client, setClient] = React.useState(false);
  console.log("CLIENT", client)
  useIsomorphicLayoutEffect(() => {
    setClient(true);
  }, []);
  return client ? props.children : null;
}