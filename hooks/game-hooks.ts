import { PARTYKIT_HOST } from "@/env";
import { ClientLanderEngine } from "@/game/engine";
import { LanderGameState } from "@/game/game-state";
import { PACKR } from "@/game/packr";
import assert from "assert";
import usePartySocket from "partysocket/react";
import React from "react";

export function useLanderSocket(roomId: string) {
  const [game, setGame] = React.useState<null | LanderGameState>(null);
  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    async onMessage(event) {
      const buffer = await event.data.arrayBuffer();
      const data = PACKR.unpack(buffer);
      if (data.type === "init") {
        setGame(LanderGameState.createFromFull(data.payload));
      } else if (data.type === "full") {
        assert(game);
        game.mergeFull(data.payload);
      } else if (data.type === "partial") {
        assert(game);
        game.mergePartial(data.payload);
      }
    }
  });

  React.useEffect(() => {
    if (game) {
      const keyUpHandler = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key.startsWith("Arrow")) {
          const key = event.key.replace("Arrow", "").toLowerCase() as any;
          console.log("KEYUP", key);
          engine.processInput({ type: "keyup", key})
        }
      };
      const keyDownHandler = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key.startsWith("Arrow")) {
          const key = event.key.replace("Arrow", "").toLowerCase() as any;
          console.log("KEYDOWN", key);
          engine.processInput({ type: "keydown", key})
        }
      };

      document.addEventListener("keyup", keyUpHandler);
      document.addEventListener("keydown", keyDownHandler);
      const engine = new ClientLanderEngine(game, socket);
      const id = setInterval(() => {
        engine.step(); 
      }, 1000/60);
      return () => {
        document.removeEventListener("keyup", keyUpHandler);
        document.removeEventListener("keydown", keyDownHandler);
        clearInterval(id);
      }
    }
  }, [game, socket]);

  return {
    game,
    socket
  };
}