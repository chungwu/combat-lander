import { ClientMessage, ServerMessage } from "@/messages";
import { Vector2 } from "@dimforge/rapier2d";
import { Connection, Room } from "partykit/server";
import { BaseLanderEngine } from "./engine";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import { PACKR } from "./packr";

export class ServerLanderEngine extends BaseLanderEngine {
  constructor(state: LanderGameState, private room: Room) {
    super(state);
  }

  private addPlayer(opts: { id: string, name: string }) {
    const lander = Lander.create(this.game, { 
      ...opts,
      startingLocation: new Vector2(
        Math.random() * this.game.moon.worldWidth, 
        this.game.moon.worldHeight * 0.5
      )
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
          msg.time - 1,
          () => 0
        );
      }
      this.broadcast(msg);
    }
  }

  step() {
    // If there are player inputs from the future, apply them now
    // before we step
    this.applyPlayerInputsAt(m => m.time === this.timestep);

    super.step();

    if (this.timestep % SERVER_SNAPSHOT_FREQ === 0) {
      this.saveSnapshot();
    }

    // Send partial state update every second
    if (this.timestep % PARTIAL_UPDATE_FREQ === 0) {
      this.broadcast({
        type: "partial",
        time: this.timestep,
        payload: this.game.serializePartial()
      });
    }

    // Garbage collect snapshots every minute
    if (this.timestep % SERVER_SNAPSHOT_GC_FREQ === 0) {
      this.garbageCollect(SERVER_SNAPSHOT_GC_FREQ);
    }
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(PACKR.pack(msg));
  }
}

const PARTIAL_UPDATE_FREQ = 60; // once per second
const SERVER_SNAPSHOT_GC_FREQ = 60 * 60; // every 60 seconds
const SERVER_SNAPSHOT_FREQ = 10; // save snapshot every quarter second