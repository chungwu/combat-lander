import { ClientMessage, GameInputEvent, ServerMessage } from "@/messages";
import { Vector2 } from "@dimforge/rapier2d";
import { Connection, Room } from "partykit/server";
import { BaseLanderEngine } from "./engine";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import { PACKR } from "./packr";
import { LANDER_COLORS, PARTIAL_SYNC_FREQ, SERVER_SNAPSHOT_FREQ, SERVER_SNAPSHOT_GC_FREQ } from "./constants";
import random from "lodash/random";

export class ServerLanderEngine extends BaseLanderEngine {
  private shouldImmediatelyBroadcastSync = false;

  constructor(state: LanderGameState, private room: Room) {
    super(state, SERVER_SNAPSHOT_FREQ);
  }

  private addPlayer(opts: { id: string, name: string }) {
    const usedColors = this.game.landers.map(s => s.color);
    let availableColors = LANDER_COLORS.filter(x => !usedColors.includes(x));
    if (availableColors.length === 0) {
      availableColors = LANDER_COLORS;
    }
    const lander = Lander.create(this.game, { 
      ...opts,
      startingLocation: new Vector2(
        Math.random() * this.game.moon.worldWidth, 
        this.game.moon.worldHeight * 0.5
      ),
      color: availableColors[random(0, availableColors.length - 1)]
    });
    this.game.landers.push(lander);
  }

  handleMessage(sender: Connection, msg: ClientMessage) {
    console.log(`[${this.timestep}] GOT MESSAGE @ ${msg.time} of ${msg.type}`)
    if (msg.type === "join") {
      this.addPlayer({
        id: sender.id,
        name: msg.name
      });
      this.broadcast({
        type: "full",
        payload: this.game.serializeFull(),
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
    }
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
      payload: this.game.serializePartial()
    } as const;
  }
}
