import { PARTYKIT_HOST } from "@/env";
import { ClientLanderEngine } from "@/game/client-engine";
import { KeyboardController } from "@/game/controls";
import { LanderGameState } from "@/game/game-state";
import { PACKR } from "@/game/packr";
import { ServerMessage } from "@/messages";
import assert from "assert";
import usePartySocket from "partysocket/react";
import React from "react";

export function useLanderSocket(roomId: string) {
  const [game, setGame] = React.useState<null | LanderGameState>(null);
  const [engine, setEngine] = React.useState<null | ClientLanderEngine>(null);
  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    async onMessage(event) {
      const buffer = await event.data.arrayBuffer();
      const data = PACKR.unpack(buffer) as ServerMessage;
      if (data.type === "init") {
        const game = LanderGameState.createFromFull(data.payload);
        const engine = new ClientLanderEngine(game, socket, data.time);
        setGame(game);
        setEngine(engine);
        (globalThis as any).ENGINE = engine;
      } else {
        assert(engine);
        engine.handleMessage(data);
      }
    }
  });

  React.useEffect(() => {
    if (game && engine) {
      const controller = new KeyboardController(engine);
      controller.install();
      const id = setInterval(() => {
        engine.timerStep(); 
      }, 1000/60);
      return () => {
        controller.uninstall();
        clearInterval(id);
      }
    }
  }, [game, engine, socket]);

  return {
    game,
    socket,
    engine
  };
}