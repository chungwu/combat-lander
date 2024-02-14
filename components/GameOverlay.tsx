import { JOYSTICK_CONFIG, ROCKET_STATS, RocketType, getLanderColor } from "@/game/constants";
import { PseudoKeyboardEvent } from "@/game/controls";
import { Lander } from "@/game/objects/lander";
import { faArrowDown, faArrowLeft, faArrowRight, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import sortBy from "lodash/sortBy";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { DialogTrigger, Heading } from "react-aria-components";
import { Button } from "./Button";
import sty from "./GameOverlay.module.css";
import { JoinGameDialog } from "./JoinGameDialog";
import { Modal } from "./Modal";
import { useClientEngine } from "./contexts";
import { Button as BaseButton } from "react-aria-components";
import { ensure, isTouchDevice } from "@/utils/utils";
import { Joystick } from "react-joystick-component";

export const GameOverlay = observer(function GameOverlay() {
  return (
    <div className={sty.root}>
      <TopRight />
      <MajorGameMessage />
      <LeaderBoard />
      <DamageFlasher />
      <KeyboardControlsOverlay />
    </div>
  )
});

const TopRight = observer(function TopRight(props: {}) {
  const engine = useClientEngine();
  const game = engine.game;
  return (
    <div className={sty.topRight}>
    {engine.isPlaying ? (
      <ResetGameButton />
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
}) {
  const engine = useClientEngine();
  const game = engine.game;
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
}) {
  const engine = useClientEngine();
  const game = engine.game;
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
      const left = Math.max(0, Math.ceil((target - new Date().getTime()) / 1000));
      if (left !== secondsLeft) {
        setSecondsLeft(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [target]);
  return secondsLeft;
}

const LeaderBoard = observer(function LeaderBoard(props: {
}) {
  const engine = useClientEngine();
  const game = engine.game;
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
}) {
  const engine = useClientEngine();
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

const KeyboardControlsOverlay = observer(function KeyboardOverlay(props: {
}) {
  const engine = useClientEngine();
  return (
    <div className={sty.keyboardControlsOverlay}>
      {engine.isPlaying && 
        <>
          {JOYSTICK_CONFIG.use ? <JoystickOverlay /> : <ArrowKeysOverlay />}
          <WeaponControlsOverlay />
        </>
      }
    </div>
  )
});

const WeaponControlsOverlay = observer(function WeaponControlsOverlay() {
  const engine = useClientEngine();
  const lander = engine.selfLander;
  if (!lander) {
    return null;
  }
  return (
    <div className={sty.weaponControlsOverlay}>
      <div className={sty.weaponRow}>
        <div className={sty.weaponRowKey}>
          <KeyboardKey keyboardKey="q">q</KeyboardKey>
        </div>
        <div className={sty.ammos}>
          <RocketAmmos lander={lander} type={"small"} />
        </div>
      </div>
      <div className={sty.weaponRow}>
        <div className={sty.weaponRowKey}>
          <KeyboardKey keyboardKey="w">w</KeyboardKey>
        </div>
        <div className={sty.ammos}>
          <RocketAmmos lander={lander} type={"big"} />
        </div>
      </div>
    </div>
  )
});

const RocketAmmos = observer(function RocketAmmos(props: {
  lander: Lander;
  type: RocketType;
}) {
  const { lander, type } = props;

  const STATS = ROCKET_STATS[type];
  const state = lander.rocketState[type];
  return (
    <>
      {new Array(STATS.ammo).fill(0).map((_, index) => (
        <Rocket 
          color={getLanderColor(lander.color, 8)}
          type={type}
          state={index < state.count ? "available" : index === state.count ? "refilling" : "used"}
        /> 
      ))}
    </>
  )
});

const Rocket = observer(function Rocket(props: {
  color: string;
  state: "available" | "used" | "refilling";
  type: RocketType
}) {
  const { color, state, type } = props;
  const size = type === "small" ? 18 : 32;
  return (
    <div
      className={classNames(sty.rocket, {
        [sty.rocketUsed]: state === "used",
        [sty.rocketRefilling]: state === "refilling"
      })}
      style={{
        borderColor: color,
        width: size,
        height: size
      }}
    >
      {state === "refilling" ? (
        <RefillingRocketProgress color={color} type={type} />
      ) : state === "available" ? (
        <div className={sty.rocketProgress} 
          style={{
            backgroundColor: color,
            width: "100%",
          }}
        />
      ) : null}
    </div>
  );
});

const RefillingRocketProgress = observer(function RefillingRocketProgress(props: {
  color: string;
  type: RocketType;
}) {
  const { type, color } = props;
  const engine = useClientEngine();
  const lander = engine.selfLander;
  if (!lander) {
    return null;
  }
  const progress = (engine.timestep - (lander.rocketState[type].replenishFromTimestep)) / ROCKET_STATS[type].replenishSteps;
  return (
    <div className={sty.rocketProgress} 
      style={{
        backgroundColor: color,
        width: `${Math.min(1, progress) * 100}%`,
      }}
    />
  );
})

const ArrowKeysOverlay = observer(function ArrowKeysOverlay(props: {
}) {
  return (
    <div className={classNames(sty.arrowKeysOverlay)} style={{display: "flex", flexDirection: "column", gap: 8}}>
      <div style={{display: "flex", justifyContent: "center"}}>
        <KeyboardKey keyboardKey="ArrowUp">
          <FontAwesomeIcon icon={faArrowUp} />
        </KeyboardKey>
      </div>
      <div style={{display: "flex", justifyContent: "center", gap: 8}}>
        <KeyboardKey keyboardKey="ArrowLeft">
          <FontAwesomeIcon icon={faArrowLeft} />
        </KeyboardKey>
        <KeyboardKey keyboardKey="ArrowDown">
          <FontAwesomeIcon icon={faArrowDown} />
        </KeyboardKey>
        <KeyboardKey keyboardKey="ArrowRight">
          <FontAwesomeIcon icon={faArrowRight} />
        </KeyboardKey>
      </div>
    </div>
  )
});


const JoystickOverlay = observer(function JoystickOverlay(props: {

}) {
  const engine = useClientEngine();
  const [ pos, setPos ] = React.useState<{x: number, y: number}|undefined>(undefined);
  const controller = engine.controller;
  return (
    <div className={sty.joystickOverlay}>
      <Joystick 
        stickColor={getLanderColor(ensure(engine.selfLander).color, 8)}
        move={event => {
          controller.handleJoystickMove(event);
        }} 
        pos={pos}
        stop={event => {
          const nextPos = controller.handleJoystickStop();
          setPos(nextPos);
        }}
        size={200}
      />
    </div>
  )
});

interface KeyboardKeyRef {
  flash: () => void;
  showPressed: () => void;
  showUnpressed: () => void;
}
const KeyboardKey = observer(function KeyboardKey(props: {
  children?: React.ReactNode;
  keyboardKey: string;
}, ref: React.Ref<KeyboardKeyRef>) {
  const { children, keyboardKey } = props;
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const bgRef = React.useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = React.useState(false);
  const engine = useClientEngine();
  const controller = engine.controller;

  const flash = React.useCallback(() => {
    if (bgRef.current) {
      bgRef.current.animate([
        { opacity: 0 },
        { opacity: 0.75 },
        { opacity: 0 },
      ], {duration: 200, iterations: 1});
    }
  }, [bgRef]);

  React.useImperativeHandle(ref, () => ({
    flash,
    showPressed: () => {
      setPressed(true);
    },
    showUnpressed: () => {
      setPressed(false);
    }
  }), [bgRef, setPressed, flash]);

  React.useEffect(() => {
    const listener = (event: PseudoKeyboardEvent) => {
      if (event.key === keyboardKey) {
        if (event.type === "keydown") {
          setPressed(true);
        } else if (event.type === "keyup") {
          setPressed(false);
        } else if (event.type === "keypress") {
          flash();
        }
      }
    };
    controller.addListener(listener);
    return () => {
      controller.removeListener(listener);
    }
  }, [controller, keyboardKey]);
  return (
    <BaseButton
      className={classNames(sty.key, {[sty.keyTouchable]: isTouchDevice()})} 
      ref={buttonRef}
      onPress={() => {
        controller.handleKeyEvent({type: "keypress", key: keyboardKey});
      }}
      onPressStart={() => {
        setPressed(true);
        controller.handleKeyEvent({type: "keydown", key: keyboardKey});
      }}
      onPressEnd={() => {
        setPressed(false)
        controller.handleKeyEvent({type: "keyup", key: keyboardKey});
      }}
    >
      <div className={classNames(sty.keyBg, {
        [sty.keyBgPressed]: pressed
      })} ref={bgRef} />
      {children}
    </BaseButton>
  );
}, {forwardRef: true})