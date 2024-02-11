import { PARTYKIT_HOST } from "@/env";
import { ClientLanderEngine } from "@/game/client-engine";
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
      } else {
        assert(engine);
        engine.handleMessage(data);
      }
    }
  });

  React.useEffect(() => {
    if (game && engine) {
      const keyUpHandler = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key.startsWith("Arrow")) {
          const key = event.key.replace("Arrow", "").toLowerCase() as any;
          engine.processLocalInput({ type: "keyup", key})
        } else if (event.key === "q") {
          engine.processLocalInput( { type: "fire-rocket", rocketType: "small"});
        }
      };
      const keyDownHandler = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key.startsWith("Arrow")) {
          const key = event.key.replace("Arrow", "").toLowerCase() as any;
          engine.processLocalInput({ type: "keydown", key})
        }
      };

      document.addEventListener("keyup", keyUpHandler);
      document.addEventListener("keydown", keyDownHandler);
      const id = setInterval(() => {
        engine.step(); 
      }, 1000/60);
      return () => {
        document.removeEventListener("keyup", keyUpHandler);
        document.removeEventListener("keydown", keyDownHandler);
        clearInterval(id);
      }
    }
  }, [game, engine, socket]);

  return {
    game,
    socket
  };
}