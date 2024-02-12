import { ClientMessage, GameInputEvent, ServerMessage } from "@/messages";
import { Vector2 } from "@dimforge/rapier2d";
import { Connection, Room } from "partykit/server";
import { BaseLanderEngine } from "./engine";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import { PACKR } from "./packr";
import { LANDER_COLORS, LanderColor, PARTIAL_SYNC_FREQ, RESET_GAME_WAIT, SERVER_SNAPSHOT_FREQ, SERVER_SNAPSHOT_GC_FREQ } from "./constants";
import random from "lodash/random";
import pull from "lodash/pull";

export class ServerLanderEngine extends BaseLanderEngine {
  private shouldImmediatelyBroadcastSync = false;
  private viewerIds: string[] = [];
  private intervalId: any | undefined;

  constructor(private room: Room) {
    const game = LanderGameState.createNew();
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
      this.broadcast({
        type: "full",
        payload: this.game.serializeFull(),
        gameId: this.game.id,
        time: this.timestep
      });
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
    } else if (msg.type === "request-reset") {
      // Reset in 10 seconds
      const waitTime = 1000 * RESET_GAME_WAIT;
      this.game.resetTimestamp = new Date().getTime() + waitTime;
      this.broadcast(this.makeMetaMessage());
      setTimeout(() => {
        if (this.game.resetTimestamp != undefined) {
          // Really reset the game!
          const prevGame = this.game;
          const newGame = LanderGameState.createNew();
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
            }
          }
          this.timestep = 0;
          this.reset();
          this.broadcast({
            type: "reset",
            paylod: this.game.serializeFull(),
            gameId: this.game.id,
            time: this.timestep
          });
        }
      }, waitTime);
    } else if (msg.type === "cancel-reset") {
      this.game.resetTimestamp = undefined;
      this.broadcast(this.makeMetaMessage());
    }
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

    // Send partial state update every second
    if (this.timestep % PARTIAL_SYNC_FREQ === 0 || this.shouldImmediatelyBroadcastSync) {
      this.broadcast(this.makePartialMessage());
    }

    // Garbage collect snapshots every minute
    if (this.timestep % SERVER_SNAPSHOT_GC_FREQ === 0) {
      this.garbageCollect(SERVER_SNAPSHOT_GC_FREQ);
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
  }

  protected applyPlayerInput(playerId: string, event: GameInputEvent): void {
    super.applyPlayerInput(playerId, event);
    if (event.type === "fire-rocket") {
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
