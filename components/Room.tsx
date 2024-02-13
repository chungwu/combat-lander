import { useLanderSocket } from "@/hooks/game-hooks";
import { GameCanvas } from "./GameCanvas";
import sty from "./Room.module.css";
import { GameOverlay } from "./GameOverlay";
import { ClientEngineProvider } from "./contexts";

export function Room(props: {
  roomId: string
}) {
  const { roomId } = props;
  console.log("ROOM", roomId)
  const { game, engine } = useLanderSocket(roomId);
  (globalThis as any).game = game;

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
