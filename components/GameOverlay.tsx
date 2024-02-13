import { ClientLanderEngine } from "@/game/client-engine";
import { LanderGameState } from "@/game/game-state";
import sortBy from "lodash/sortBy";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { DialogTrigger, Heading } from "react-aria-components";
import { Button } from "./Button";
import sty from "./GameOverlay.module.css";
import { JoinGameDialog } from "./JoinGameDialog";
import { Modal } from "./Modal";
import classNames from "classnames";

export const GameOverlay = observer(function GameOverlay(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;

  return (
    <div className={sty.root}>
      <TopRight game={game} engine={engine} />
      <MajorGameMessage game={game} engine={engine} />
      <LeaderBoard game={game} engine={engine} />
      <DamageFlasher game={game} engine={engine} />
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

const MajorGameMessage = observer(function MajorGameMessage(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;
  if (game.winnerPlayerId) {
    const lander = game.landers.find(l => l.id === game.winnerPlayerId);
    return (
      <Modal modalBlur isOpen>
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 24}}>
          <Heading slot="title">{lander?.name} has won!!!</Heading>
          <div>
            Restarting in <TimerTill target={game.resetTimestamp!}/>s...
          </div>
        </div>
      </Modal>
    );
  } else if (game.resetTimestamp) {
    return (
      <Modal modalBlur isOpen>
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 24}}>
          <Heading slot="title">Restarting in <TimerTill target={game.resetTimestamp}/>s...</Heading>
          <div>
            <Button onPress={() => engine.cancelResetGame()}>Cancel!</Button>
          </div>
        </div>
      </Modal>
    );
  }
  return null;
})

const ResetGameButton = observer(function ResetGameButton(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;
  if (!game.resetTimestamp) {
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

const LeaderBoard = observer(function LeaderBoard(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;
  if (game.landers.length <= 1) {
    return null;
  }

  const landers = sortBy(game.landers, l => -(game.playerWins[l.id] ?? 0)).slice(0, 5);
  return (
    <div className={sty.leaderBoard}>
      <h3>Leaderboard</h3>
      <ol>
        {landers.map(lander => (
          <li className={sty.leaderBoardItem} key={lander.id}>
            <span>{lander.name}</span>
            <span>{game.playerWins[lander.id] ?? 0}</span>
          </li>
        ))}
      </ol>
    </div>
  );
});

const DamageFlasher = observer(function DamageFlasher(props: {
  game: LanderGameState;
  engine: ClientLanderEngine;
}) {
  const { game, engine } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const lander = engine.selfLander;
  React.useEffect(() => {
    const dispose = reaction(
      () => {
        return lander?.health
      },
      (health, prevHealth) => {
        if (health != null && prevHealth != null && health < prevHealth) {
          // Took damage!
          if (ref.current) {
            ref.current.animate([
              {opacity: 0},
              {opacity: 0.5},
              {opacity: 0}
            ], {
              duration: 150, iterations: 1
            })
          }
        }
      }
    );
    return () => {
      dispose();
    };
  }, [lander, ref]);

  return (
    <div 
      className={classNames(
        sty.damageFlasher, {
          [sty.damageFlasherDead]: lander && !lander.isAlive()
        })} 
      ref={ref} 
    />
  );
});