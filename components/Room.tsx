import { useLanderSocket } from "@/hooks/game-hooks";
import { GameCanvas } from "./GameCanvas";
import sty from "./Room.module.css";
import { GameOverlay } from "./GameOverlay";
import { ClientEngineProvider } from "./contexts";
import { useRouter } from "next/router";
import React from "react";
import { setControlScheme } from "@/game/controls";

export function Room(props: {
  roomId: string
}) {
  const { roomId } = props;
  const { game, engine } = useLanderSocket(roomId);
  (globalThis as any).game = game;
  const flags = useRouter().query;

  if (flags.joystick) {
    setControlScheme(flags.joystick as any);
  }

  return (
    <div className={sty.root}>
      {game && engine ? (
        <ClientEngineProvider engine={engine}>
          <GameCanvas game={game} playerId={engine.playerId}/>
          <GameOverlay />
        </ClientEngineProvider>
      ) : "Connecting to game server..."}
    </div>
  );
}

export default Room;
