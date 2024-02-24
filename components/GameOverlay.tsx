import { ROCKET_STATS, RocketType, getLanderColor } from "@/game/constants";
import { PseudoKeyboardEvent, getControlScheme } from "@/game/controls";
import { Lander } from "@/game/objects/lander";
import { blurActive, isFullScreenMode } from "@/utils/dom-utils";
import { ensure, isTouchDevice, makeShortId } from "@/utils/utils";
import { faArrowDown, faArrowLeft, faArrowRight, faArrowUp, faBars, faMessage, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import sortBy from "lodash/sortBy";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/router";
import React from "react";
import { Button as BaseButton, DialogTrigger, Form, Heading, MenuTrigger } from "react-aria-components";
import { Joystick, JoystickShape } from "react-joystick-component";
import { Button } from "./Button";
import sty from "./GameOverlay.module.css";
import { Menu, MenuItem, MenuSeparator, Popover } from "./Menu";
import { Alert, Modal } from "./Modal";
import { ChatDialog, InviteGameDialog, JoinGameDialog, PlayerInfoDialog, ResetGameDialog, StartGameDialog } from "./dialogs";
import { useClientEngine } from "./contexts";
import { ChatMessage } from "@/messages";
import { gray, grayDark, yellowDark } from "@radix-ui/colors";
import { TextField } from "./TextField";

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
  const prevName = localStorage.getItem("playerName");
  const { isFullScreen, toggleFullScreen } = useToggleFullScreen();
  const [ resetOpen, setResetOpen ] = React.useState(false);
  const [ playerSettingsOpen, setPlayerSettingsOpen ] = React.useState(false);
  const router = useRouter();
  const roomId = router.query.roomId as string;

  const maybeSavePlayerName = (name: string) => {
    if (!name.startsWith("Player ")) {
      // Store a "real" name for future use
      localStorage.setItem("playerName", name);
    }
  };

  return (
    <>
      <div className={sty.topRight}>
        <div className={sty.topRightRow}>
          {engine.isPlaying ? (
            <>
              <DialogTrigger>
                <Button>
                  Invite
                </Button>
                <InviteGameDialog />
              </DialogTrigger>
            </>
          ) : game.landers.length === 0 ? (
            <DialogTrigger>
              <Button size="large" styleType="super-primary">
                Start game!
              </Button>
              <StartGameDialog
                defaultName={prevName ?? `Player 1`}
                onStart={(opts) => {
                  maybeSavePlayerName(opts.name);
                  engine.startGame(opts.name, opts.options);
                }}
              />
            </DialogTrigger>
          ) : (
            <DialogTrigger>
              <Button
                size="large"
                styleType="super-primary"
              >
                Join
              </Button>
              <JoinGameDialog 
                defaultName={prevName ?? `Player ${game.landers.length + 1}`}
                onJoin={opts => {
                  maybeSavePlayerName(opts.name);
                  engine.joinGame(opts);
                }}
              />
            </DialogTrigger>
          )}
          <MenuTrigger>
            <Button aria-label="Menu"><FontAwesomeIcon icon={faBars} style={{width: 16}} /></Button>
            <Popover placement="bottom right">
              <Menu onAction={(action) => {
                if (action === "start-private-game") {
                  router.push(`/${makeShortId()}`)
                } else if (action === "restart-game") {
                  setResetOpen(true);
                } else if (action === "toggle-full-screen") {
                  toggleFullScreen();
                } else if (action === "player-settings") {
                  setPlayerSettingsOpen(true);
                }
              }}>
                {engine.isPlaying && (
                  <MenuItem id="restart-game">
                    Reset this game
                  </MenuItem>
                )}
                {roomId === "public" && (
                  <MenuItem id="start-private-game">
                    Start private game
                  </MenuItem>
                )}
                {isTouchDevice() && (
                  <MenuItem id="toggle-full-screen">
                    {isFullScreen ? "Exit fullscreen mode" : "Fullscreen mode"}
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem id="player-settings">Player settings</MenuItem>
                <MenuSeparator />
                <MenuItem
                  target="_blank" href={"https://github.com/chungwu/combat-lander"}>About</MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
        <div className={sty.topRightRow}>
          <ChatButton />
        </div>
        <Chats />
      </div>
      {resetOpen && (
        <ResetGameDialog
          isOpen
          onStart={(options) => {
            engine.resetGame(options, { preserveMap: false, preserveScores: false});
          }}
          onClose={() => {
            setResetOpen(false);
            blurActive();
          }}
        />
      )}
      {playerSettingsOpen && (
        <PlayerInfoDialog
          curSettings={{
            name: engine.selfLander?.name ?? localStorage.getItem("playerName") ?? "Player"
          }}
          onSave={(opts) => {
            maybeSavePlayerName(opts.name);
            engine.setPlayerSettings({name: opts.name});
          }}
          isOpen
          onClose={() => setPlayerSettingsOpen(false)}
        />
      )}
    </>
  );
});

const MajorGameMessage = observer(function MajorGameMessage(props: {
}) {
  const engine = useClientEngine();
  const game = engine.game;
  if (game.wonPlayer) {
    const lander = game.landers.find(l => l.id === game.wonPlayer?.playerId);
    return (
      <Alert modalBlur isOpen>
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 24}}>
          <Heading slot="title">
            {game.wonPlayer.reason === "last-lander" ? `${lander?.name} is last lander standing!` : `${lander?.name} has landed!`}
          </Heading>
          {engine.resetPending && (
            <div>
              Restarting in <TimerTill target={engine.resetPending.resetTimestamp!}/>s...
            </div>
          )}
        </div>
      </Alert>
    );
  } else if (engine.resetPending && engine.resetPending.cause !== "won") {
    return (
      <Alert modalBlur isOpen>
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 24}}>
          {engine.resetPending.cause === "dead" ? (
            <>
              <Heading slot="title">
                Everyone crashed!
              </Heading>
              <div>
                Restarting in <TimerTill target={engine.resetPending.resetTimestamp}/>s...
              </div>
            </>
          ) : (
            <>
              <Heading slot="title">
                Starting new game in <TimerTill target={engine.resetPending.resetTimestamp}/>s...
              </Heading>
              <div>
                <Button autoFocus onPress={() => engine.cancelResetGame()}>Cancel!</Button>
              </div>
            </>
          )}
        </div>
      </Alert>
    );
  }
  return null;
})

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
  if (game.landers.length < 1) {
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
        if (health != null && prevHealth != null && health !== 100) {
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
  const scheme = getControlScheme();
  return (
    <div className={sty.keyboardControlsOverlay}>
      {engine.isPlaying && 
        <>
          {scheme === "keyboard" ? <ArrowKeysOverlay /> : scheme === "duo" ? <DuoJoystickOverlay /> : <JoystickOverlay />}
          <WeaponControlsOverlay middle={scheme === "duo"} />
        </>
      }
    </div>
  )
});

const WeaponControlsOverlay = observer(function WeaponControlsOverlay(props: {middle?: boolean}) {
  const { middle } = props;
  const engine = useClientEngine();
  const lander = engine.selfLander;
  if (!lander) {
    return null;
  }
  return (
    <div className={classNames(sty.weaponControlsOverlay, {[sty.weaponControlsOverlayMiddle]: middle})}>
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


const JoystickOverlay = observer(function JoystickOverlay() {
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
        size={150}
      />
    </div>
  )
});

const DuoJoystickOverlay = observer(function JoystickOverlay() {
  const engine = useClientEngine();
  const [ x, setX ] = React.useState<number>(0);
  const [ y, setY ] = React.useState<number>(0);
  const controller = engine.controller;
  return (
    <div className={classNames(sty.joystickOverlay, sty.joystickDuoOverlay)}>
      <div className={sty.joystickX}>
        <Joystick 
          controlPlaneShape={JoystickShape.AxisX}
          stickColor={getLanderColor(ensure(engine.selfLander).color, 8)}
          move={event => {
            controller.handleJoystickMove({x: event.x ?? 0, y: null});
          }}
          stop={event => {
            const nextPos = controller.handleJoystickStop();
            if (nextPos) {
              setX(nextPos.x);
            }
          }}
          pos={{x, y: 0}}
          size={100}
          stickSize={50}
        />
      </div>
      <div className={sty.joystickY}>
        <Joystick 
          controlPlaneShape={JoystickShape.AxisY}
          stickColor={getLanderColor(ensure(engine.selfLander).color, 8)}
          move={event => {
            controller.handleJoystickMove({x: null, y: event.y ?? 0});
          }}
          pos={{x: 0, y}}
          stop={event => {
            const nextPos = controller.handleJoystickStop();
            if (nextPos) {
              setY(nextPos.y);
            }
          }}
          size={100}
          stickSize={50}
        />
      </div>
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
      className={classNames(sty.key)} 
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

function useToggleFullScreen() {
  const [isFull, setFull] = React.useState(false);

  React.useEffect(() => {
    const handler = () => {
      setFull(isFullScreenMode());
    };
    document.addEventListener("fullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
    }
  }, [])

  return {
    isFullScreen: isFull,
    toggleFullScreen: async () => {
      if (isFull) {
        document.exitFullscreen();
        setFull(false);
        return false;
      } else {
        await document.body.requestFullscreen();
        setFull(true);
        return true;
      }
    }
  };
}

function ChatButton() {
  const engine = useClientEngine();
  const [showForm, setShowForm] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "t") {
        event.preventDefault();
        event.stopPropagation();
        setShowForm(true);
      }
    };
    document.addEventListener("keypress", listener);
    return () => {
      document.removeEventListener("keypress", listener);
    };
  }, []);

  return (
    <div className={sty.topRightRow}>
      {showForm && (
        <Form
          ref={formRef}
          style={{display: "flex", gap: 8, alignItems: "center"}}
          onSubmit={e => {
            console.log("SUBMITTED", formRef.current);
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const message = data.get("message")?.toString();
            if (message) {
              engine.sendChat({message});
            }
            setShowForm(false);
          }}
        >
          <TextField 
            className={sty.chatInput}
            name="message"
            aria-label="Message"
            autoFocus
            autoComplete="off"
            placeholder="Type a message..."
            onKeyUp={e => {
              if (e.key === "Escape") {
                setShowForm(false);
              }
            }}
            onFocusChange={(focused) => {
              if (!focused) {
                setTimeout(() => {
                  setShowForm(false);
                }, 100);
              }
            }}
          />
          <Button 
            aria-label="Send" 
            type="submit"
            key="chat-submit"
          >
            <FontAwesomeIcon icon={faPaperPlane}/>
          </Button>
        </Form>
      )}
      {!showForm &&
        <Button
          type="button"
          aria-label="Chat" 
          key="chat-button"
          onPress={(e) => {
            // For some reason, if we don't wrap this in setTimeout, then
            // this click is interpreted as a click on the submit button
            // as well, and submits the form immediately...?!?!
            setTimeout(() => {
              setShowForm(true);
            }, 100);
          }}
        >
          <FontAwesomeIcon icon={faMessage}/>
        </Button>
      }
    </div>
  );
}

function Chats() {
  const [chats, setChats] = React.useState<ChatMessage[]>([]);
  const engine = useClientEngine();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const listener = (msg: ChatMessage) => {
      setChats((chats) => [...chats, msg]);
    };
    engine.addChatListener(listener);
    return () => {
      engine.removeChatListener(listener);
    }
  }, [engine, setChats]);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.scrollTo(0, ref.current.clientHeight);
    }
  });

  React.useEffect(() => {
    const id = setInterval(() => {
      setChats(chats => {
        // Keep messages for 10 seconds
        const filtered = chats.filter(c  => c.time > (engine.timestep - 1000 * 60));
        if (filtered.length !== chats.length) {
          return filtered;
        } else {
          return chats;
        }
      });
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [setChats, engine]);

  return (
    <div className={sty.chats} ref={ref}>
      {chats.map((chat) => <ChatMessage key={`${chat.playerId}-${chat.time}`} chat={chat} />)}
    </div>
  );
}

function ChatMessage(props: {
  chat: ChatMessage;
}) {
  const { chat } = props;
  const engine = useClientEngine();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bgRef = React.useRef<HTMLDivElement>(null);
  const lander = engine.game.landers.find(l => l.id === chat.playerId);

  const color = lander ? getLanderColor(lander.color, 5) : grayDark.gray5;
  React.useEffect(() => {
    if (bgRef.current) {
      bgRef.current.animate([
        { backgroundColor: color, opacity: 0.5},
        { backgroundColor: yellowDark.yellow10, opacity: 0.8 },
        {  backgroundColor: color, opacity: 0.5},
      ], {duration: 900, iterations: 1})
    }
    if (rootRef.current) {
      rootRef.current.animate([
        {opacity: 0, marginBottom: "20px"},
        {opacity: 1, marginBottom: "0px"}
      ], {duration: 200, iterations: 1})
    }
  }, [bgRef, rootRef, color]);

  return (
    <div 
      className={sty.chatMessage}
      ref={rootRef}
    >
      <div 
        className={sty.chatMessageBg} 
        ref={bgRef}
        style={{
          backgroundColor: color
        }} 
      />
      <span className={sty.chatMessageAuthor}>
        {lander?.name ?? "(unknown)"}:
      </span> {chat.message}
    </div>
  );
}