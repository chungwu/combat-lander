import { ClientLanderEngine } from "@/game/client-engine";
import { LanderGameState } from "@/game/game-state";
import sty from "./GameOverlay.module.css";
import { Button } from "./Button";
import { DialogTrigger, Input } from "react-aria-components";
import { JoinGameDialog } from "./JoinGameDialog";
import { observer } from "mobx-react-lite";

export const GameOverlay = observer(function GameOverlay(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;

  return (
    <div className={sty.root}>
      {engine.isPlaying ? (
        null
      ) : (
        <DialogTrigger>
          <div
            style={{position: "absolute", right: 24, top: 24}}
          >
            <Button
              // onPress={() => engine.joinGame({
              //   name: `Player ${game.landers.length + 1}`
              // })}
              size="large"
              styleType="super-primary"
            >
              Join
            </Button>
          </div>
          <JoinGameDialog 
            defaultName={`Player ${game.landers.length + 1}`}
            onJoin={opts => engine.joinGame(opts)}
          />
        </DialogTrigger>
      )}
    </div>
  )
});