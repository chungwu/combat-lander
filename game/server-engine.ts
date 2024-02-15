import { ClientMessage, GameInputEvent, ResetOptions, ResetPendingMessage, ServerMessage } from "@/messages";
import { Vector2 } from "@dimforge/rapier2d";
import { Connection, Room } from "partykit/server";
import { BaseLanderEngine } from "./engine";
import { GameOptions, LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import { PACKR } from "./packr";
import { LANDER_COLORS, LANDING_PAD_STATS, LanderColor, PARTIAL_SYNC_FREQ, RESET_GAME_WAIT, SERVER_SNAPSHOT_FREQ, SERVER_SNAPSHOT_GC_FREQ, WON_GAME_WAIT as END_GAME_WAIT } from "./constants";
import random from "lodash/random";
import pull from "lodash/pull";

export class ServerLanderEngine extends BaseLanderEngine {
  private shouldImmediatelyBroadcastSync = false;
  private viewerIds: string[] = [];
  private intervalId: any | undefined;
  private lastSyncTimestep: number = 0;
  private resetTimestamp: number | undefined = undefined;

  constructor(private room: Room) {
    const game = LanderGameState.createNew({
      options: {
        infiniteFuel: true,
        infiniteHealth: true,
      }
    });
    super(game, SERVER_SNAPSHOT_FREQ);
  }

  private addPlayer(opts: { id: string, name: string, color?: LanderColor }) {
    const pickColor = () => {
      const usedColors = this.game.landers.map(s => s.color);
      let availableColors = LANDER_COLORS.filter(x => !usedColors.includes(x));
      if (availableColors.length === 0) {
        availableColors = LANDER_COLORS;
      }
      return availableColors[random(0, availableColors.length - 1)];
    }
    const lander = Lander.create(this.game, { 
      ...opts,
      startingLocation: new Vector2(
        Math.random() * this.game.moon.worldWidth, 
        this.game.moon.worldHeight * 0.5
      ),
      color: opts.color ?? pickColor()
    });
    this.game.landers.push(lander);
  }

  handleMessage(sender: Connection, msg: ClientMessage) {
    if (msg.gameId !== this.game.id) {
      console.log(`[${this.timestep}] GOT obsolete message for ${msg.gameId}`);
      return;
    }
    console.log(`[${this.timestep}] GOT MESSAGE @ ${msg.time} of ${msg.type}`)
    if (msg.type === "join") {
      this.addPlayer({
        id: sender.id,
        name: msg.name
      });
      this.broadcast(this.makeFullMessage());
    } else if (msg.type === "input") {
      this.savePlayerEvent(msg);
      
      if (msg.time < this.timestep) {
        this.restoreApplyReplay(
          msg.time,
          () => 0
        );
      }
      if (this.shouldImmediatelyBroadcastSync) {
        console.log(`[${this.timestep}] Immediate broadcast`);
        this.broadcast(this.makePartialMessage())
        this.shouldImmediatelyBroadcastSync = false;
      }
      this.broadcast(msg);
    } else if (msg.type === "request-start") {
      this.addPlayer({
        id: sender.id,
        name: msg.name
      });
      this.resetGame(msg.options, {preserveMap: true, preserveScores: false});
      this.broadcast(this.makeFullMessage());
    } else if (msg.type === "request-reset") {
      // Reset in 10 seconds
      const waitTime = 1000 * RESET_GAME_WAIT;
      this.resetTimestamp = new Date().getTime() + waitTime;
      this.broadcast(this.makeResetPendingMessage("requested", this.resetTimestamp));
      setTimeout(() => {
        if (this.resetTimestamp != undefined) {
          // Really reset the game!
          this.resetGame(msg.options, msg.resetOptions);
        }
      }, waitTime);
    } else if (msg.type === "cancel-reset") {
      this.resetTimestamp = undefined;
      this.broadcast({
        type: "reset-cancelled",
        time: this.timestep,
        gameId: this.game.id,
      });
    } else if (msg.type === "request-full") {
      this.send(sender, this.makeFullMessage());
    }
  }

  protected reset() {
    super.reset();
    this.resetTimestamp = undefined;
  }

  dispose() {
    this.game.world.free();
  }

  private resetGame(gameOptions: GameOptions, resetOptions: ResetOptions) {
    const prevGame = this.game;
    const newGame = LanderGameState.createNew({
      options: gameOptions, 
      moon: resetOptions.preserveMap ? prevGame.moon : undefined
    });
    this.game = newGame;

    // Add existing players, preserving color
    for (const lander of prevGame.landers) {
      // only keep landers that are still connected
      if (this.viewerIds.includes(lander.id)) {
        this.addPlayer({
          id: lander.id,
          name: lander.name,
          color: lander.color
        });
        if (resetOptions.preserveScores) {
          newGame.playerWins[lander.id] = prevGame.playerWins[lander.id];
        }
      }
    }
    this.reset();
    this.broadcast({
      type: "reset",
      paylod: this.game.serializeFull(),
      gameId: this.game.id,
      time: this.timestep
    });
  }

  onConnect(conn: Connection) {
    this.viewerIds.push(conn.id);
    conn.send(PACKR.pack({
      type: "init",
      payload: this.game.serializeFull(),
      time: this.timestep
    }));
    this.maybeStart();
  }

  onDisconnect(conn: Connection) {
    pull(this.viewerIds, conn.id);
    this.maybeStop();
  }

  timerStep() {
    this.shouldImmediatelyBroadcastSync = false;

    super.timerStep();

    // If the game is still ongoing...
    if (!this.resetTimestamp) {
      // Check if anyone has won
      if (!this.game.winnerPlayerId) {
        // if any lander has successfully landed, that lander wins
        for (const lander of this.game.landers) {
          if (lander.isAlive()) {
            const pad = this.game.isSafelyLanded(lander);
            if (pad) {
              this.game.winnerPlayerId = lander.id;
              this.game.addWins(lander.id, LANDING_PAD_STATS[pad.type].multiplier);
            }
          }
        }
  
        // if any lander is the last one standing, that lander wins
        const controlledLanders = this.game.landers.filter(l => this.viewerIds.includes(l.id));
        const aliveLanders = controlledLanders.filter(l => l.isAlive());
        if (controlledLanders.length > 1 && aliveLanders.length === 1) {
          this.game.winnerPlayerId = aliveLanders[0].id
          this.game.addWins(aliveLanders[0].id, 1);
        }
      }

      // Restart the game if there's a winner, or if every lander is dead
      if (
        this.game.winnerPlayerId || 
        (
          this.game.landers.length > 0 && 
          this.game.landers.every(l => !l.isAlive())
        )
      ) {
        const waitTime = 1000 * END_GAME_WAIT;
        this.resetTimestamp = new Date().getTime() + waitTime;
        this.broadcast(this.makeMetaMessage());
        this.broadcast(this.makeResetPendingMessage(this.game.winnerPlayerId ? "won" : "dead", this.resetTimestamp));
        setTimeout(() => {
          if (this.resetTimestamp != undefined) {
            this.resetGame(this.game.options, { preserveMap: true, preserveScores: true});
          }
        }, waitTime);
      }
    }

    // Send partial state update every second
    if (this.timestep % PARTIAL_SYNC_FREQ === 0 || this.shouldImmediatelyBroadcastSync) {
      this.broadcast(this.makePartialMessage());
    }

    // Garbage collect snapshots every minute
    if (this.timestep % SERVER_SNAPSHOT_GC_FREQ === 0) {
      this.garbageCollect(this.timestep - SERVER_SNAPSHOT_GC_FREQ);
    }

    this.shouldImmediatelyBroadcastSync = false;
  }

  protected postStepOne() {
    super.postStepOne();
    if (this.game.maybeRemoveObjects()) {
      this.shouldImmediatelyBroadcastSync = true;
    }
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(PACKR.pack(msg));
    if (msg.type === "partial" || msg.type === "full") {
      this.lastSyncTimestep = this.timestep;
    }
  }

  private send(conn: Connection, msg: ServerMessage) {
    conn.send(PACKR.pack(msg));
  }

  protected applyPlayerInput(playerId: string, event: GameInputEvent): void {
    super.applyPlayerInput(playerId, event);
    if (event.type === "fire-rocket") {
      this.shouldImmediatelyBroadcastSync = true;
    }
    if (this.timestep < this.lastSyncTimestep) {
      console.log(`[${this.timestep}] Applied user input from before last sync (${this.lastSyncTimestep})! Immediately correct history`);
      this.shouldImmediatelyBroadcastSync = true;
    }
  }

  private makePartialMessage() {
    return {
      type: "partial",
      time: this.timestep,
      gameId: this.game.id,
      payload: this.game.serializePartial()
    } as const;
  }

  private makeFullMessage() {
    return {
      type: "full",
      time: this.timestep,
      gameId: this.game.id,
      payload: this.game.serializeFull()
    } as const;
  }

  private makeMetaMessage() {
    return {
      type: "meta",
      time: this.timestep,
      gameId: this.game.id,
      payload: this.game.serializeMeta()
    } as const;
  }

  private makeResetPendingMessage(
    cause: ResetPendingMessage["cause"],
    resetTimestamp: number
  ) {
    return {
      type: "reset-pending",
      time: this.timestep,
      gameId: this.game.id,
      cause,
      resetTimestamp
    } as const;
  }

  private maybeStart() {
    if (this.intervalId == null && this.viewerIds.length > 0) {
      this.intervalId = setInterval(() => {
        this.timerStep();
      }, 1000 / 60);
    }
  }

  private maybeStop() {
    if (this.intervalId != null && this.viewerIds.length === 0) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
