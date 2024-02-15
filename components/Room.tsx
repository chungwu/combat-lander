import { useLanderSocket } from "@/hooks/game-hooks";
import { GameCanvas } from "./GameCanvas";
import sty from "./Room.module.css";
import { GameOverlay } from "./GameOverlay";
import { ClientEngineProvider } from "./contexts";
import { useRouter } from "next/router";
import { JOYSTICK_CONFIG } from "@/game/constants";
import { isTouchDevice } from "@/utils/utils";
import React from "react";

export function Room(props: {
  roomId: string
}) {
  const { roomId } = props;
  const { game, engine } = useLanderSocket(roomId);
  (globalThis as any).game = game;
  const flags = useRouter().query;
  if (flags.joystick || isTouchDevice()) {
    JOYSTICK_CONFIG.use = true;
    JOYSTICK_CONFIG.scheme = flags.joystick as any;
  }

  React.useEffect(() => {
    if (isTouchDevice()) {
      // Request full screen mode for touch devices
      const app = document.getElementsByClassName("app")[0];
      if (app) {
        app.requestFullscreen();
      }
    }
  }, []);

  return (
    <div className={sty.root}>
      {game && engine && (
        <ClientEngineProvider engine={engine}>
          <GameCanvas game={game} playerId={engine.playerId}/>
          <GameOverlay />
        </ClientEngineProvider>
      )}
    </div>
  );
}

export default Room;
