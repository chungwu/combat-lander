import { useLanderSocket } from "@/hooks/game-hooks";
import { GameCanvas } from "./GameCanvas";

export function Room(props: {
  roomId: string
}) {
  const { roomId } = props;
  console.log("ROOM", roomId)
  const { socket, game } = useLanderSocket(roomId);
  (globalThis as any).game = game;

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      position: "relative"
    }}>
      {game && (
        <>
          <GameCanvas game={game}/>
          <div style={{
            width: "100vw",
            height: "100vh",
            position: "absolute",
            left: 0,
            top: 0
          }}>
            <button 
              style={{position: "absolute", right: 0, top: 0}}
              onClick={() => socket.send(JSON.stringify({type: "join", name: `Player ${game.landers.length + 1}`}))}
            >
              Join
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Room;
