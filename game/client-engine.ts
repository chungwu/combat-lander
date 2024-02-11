import { ClientMessage, GameInputEvent, ServerMessage } from "@/messages";
import PartySocket from "partysocket";
import { LanderGameState } from "./game-state";
import { BaseLanderEngine } from "./engine";

export class ClientLanderEngine extends BaseLanderEngine {
  constructor(
    state: LanderGameState,
    private socket: PartySocket,
    initialTimeStep: number,
  ) {
    super(state);
    this.timestep = initialTimeStep;
    this.initialTimeStep = initialTimeStep
    console.log("STARTING TIMESTAMP", this.timestep);
  }

  private sendMessage(msg: ClientMessage) {
    console.log(`[${this.timestep}] SENDING: ${msg.type} @ ${msg.time}`)
    this.socket.send(JSON.stringify(msg));
  }

  protected applyPlayerInput(playerId: string, event: GameInputEvent): void {
    if (event.type === "fire-rocket") {
      // We don't apply fire-rocket events in the client, as that is handled
      // by the server
    } else {
      super.applyPlayerInput(playerId, event);
    }
  }

  processLocalInput(event: GameInputEvent) {
    if (this.isPlaying()) {
      this.applyPlayerInput(this.socket.id, event);
      const msg = {
        type: "input",
        time: this.timestep,
        playerId: this.playerId,
        event
      } as const;
      this.savePlayerEvent(msg);
      this.sendMessage(msg);
    }
  }

  handleMessage(msg: ServerMessage) {
    console.log(`[${this.timestep}] GOT MESSAGE ${msg.type} @ ${msg.time}`);
    if (msg.type === "full") {
      if (msg.time > this.timestep) {
        this.replayTo(msg.time);
      }
      this.restoreApplyReplay(
        msg.time,
        () => this.game.mergeFull(msg.payload)
      );
    } else if (msg.type === "partial") {
      if (msg.time > this.timestep) {
        this.replayTo(msg.time);
      }
      this.restoreApplyReplay(
        msg.time,
        () => this.game.mergePartial(msg.payload)
      );
      console.log("PARTIAL", msg.payload, this.game.serializePartial());
    } else if (msg.type === "input") {
      if (msg.playerId !== this.playerId) {
        this.savePlayerEvent(msg);
        this.restoreApplyReplay(
          msg.time - 1,
          // Don't need to do anything; input will be applied
          () => 0
        );
      }
    } else if (msg.type === "init") {
      // handled before engine creation
    }
  }

  step() {
    // If there are player inputs from the future, apply them now
    // before we step
    this.applyPlayerInputsAt(m => m.time === this.timestep && m.playerId !== this.playerId);

    super.step();

    // Take snapshot
    if (this.timestep % CLIENT_SNAPSHOT_FREQ === 0) {
      this.saveSnapshot();
    }

    // Garbage collect snapshots
    if (this.timestep % CLIENT_SNAPSHOT_GC_FREQ === 0) {
      this.garbageCollect(CLIENT_SNAPSHOT_GC_FREQ);
    }
  }

  get playerId() {
    return this.socket.id;
  }

  private isPlaying() {
    return !!this.game.landers.find(l => l.id === this.socket.id);
  }
}

const CLIENT_SNAPSHOT_GC_FREQ = 60 * 60 * 3; // every 3 minutes
const CLIENT_SNAPSHOT_FREQ = 1; // save every snapshot