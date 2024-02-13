import { ClientLanderEngine } from "@/game/client-engine";
import { ensure } from "@/utils/utils";
import React from "react";

const ClientEngineContext = React.createContext<ClientLanderEngine | undefined>(undefined);

export function ClientEngineProvider(props: { engine: ClientLanderEngine, children?: React.ReactNode }) {
  const { engine, children } = props;
  return (
    <ClientEngineContext.Provider value={engine}>
      {children}
    </ClientEngineContext.Provider>
  );
}

export function useClientEngine() {
  return ensure(React.useContext(ClientEngineContext));
}