import { ClientLanderEngine } from "@/game/client-engine";
import { LanderGameState } from "@/game/game-state";
import sty from "./GameOverlay.module.css";
import { Button } from "./Button";
import { DialogTrigger, Input } from "react-aria-components";
import { JoinGameDialog } from "./JoinGameDialog";
import { observer } from "mobx-react-lite";
import React from "react";

export const GameOverlay = observer(function GameOverlay(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;

  return (
    <div className={sty.root}>
      <TopRight game={game} engine={engine} />
    </div>
  )
});

const TopRight = observer(function TopRight(props: {  
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;
  return (
    <div className={sty.topRight}>
    {engine.isPlaying ? (
      <ResetGameButton engine={engine} game={game} />
    ) : (
      <DialogTrigger>
        <Button
          size="large"
          styleType="super-primary"
        >
          Join
        </Button>
        <JoinGameDialog 
          defaultName={`Player ${game.landers.length + 1}`}
          onJoin={opts => engine.joinGame(opts)}
        />
      </DialogTrigger>
    )}
    </div>
  );
});

const ResetGameButton = observer(function ResetGameButton(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;
  if (game.resetTimestamp) {
    return (
      <div style={{display: "flex", gap: 16, alignItems: "center"}}>
        Restarting in <TimerTill target={game.resetTimestamp}/>s... <Button onPress={() => engine.cancelResetGame()}>Cancel!</Button>
      </div>
    )
  } else {
    return (
      <Button
        onPress={() => engine.resetGame()}
      >
        Restart game
      </Button>
    );
  }
});

function TimerTill(props: { target: number }) {
  const { target } = props;
  const [secondsLeft, setSecondsLeft] = React.useState(Math.ceil((target - new Date().getTime()) / 1000));
  React.useEffect(() => {
    const id = setInterval(() => {
      const left = Math.ceil((target - new Date().getTime()) / 1000);
      if (left !== secondsLeft) {
        setSecondsLeft(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [target]);
  return secondsLeft;
}