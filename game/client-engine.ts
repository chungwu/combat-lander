import { ClientMessage, GameInputEvent, ServerMessage } from "@/messages";
import PartySocket from "partysocket";
import { LanderGameState } from "./game-state";
import { BaseLanderEngine } from "./engine";
import assert from "assert";
import { CLIENT_SNAPSHOT_FREQ, CLIENT_SNAPSHOT_GC_FREQ, PARTIAL_SYNC_FREQ } from "./constants";
import { computed, makeObservable, runInAction } from "mobx";

export class ClientLanderEngine extends BaseLanderEngine {
  private lastSyncTimestep: number;
  constructor(
    state: LanderGameState,
    private socket: PartySocket,
    initialTimeStep: number,
  ) {
    super(state, CLIENT_SNAPSHOT_FREQ);
    this.timestep = initialTimeStep;
    this.initialTimeStep = initialTimeStep;
    this.lastSyncTimestep = initialTimeStep;
    makeObservable(this, {
      selfLander: computed
    });
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
    const lander = this.selfLander;
    if (lander) {
      const msg = {
        type: "input",
        time: this.timestep,
        playerId: this.playerId,
        gameId: this.game.id,
        event
      } as const;
      console.log(`[${this.timestep}] LOCAL EVENT`, msg);
      this.savePlayerEvent(msg);
      this.sendMessage(msg);
    }
  }

  handleMessage(msg: ServerMessage) {
    runInAction(() => {
      if (msg.gameId !== this.game.id && msg.type !== "reset") {
        return;
      }
      console.log(`[${this.timestep}] GOT MESSAGE ${msg.type} @ ${msg.time}`, msg, this.game.world);
      if (msg.type === "full" || msg.type === "partial") {
        // msg.time should always be > this.lastSyncTimestep as we don't expect
        // to receive sync messages out of order. It is, however, possible to 
        // receive the sync twice for the same time step, if there are two player
        // inputs that fall on the same time step that the server needs to 
        // immediately broadcast.
        assert(msg.time >= this.lastSyncTimestep, `[${this.timestep}] Got sync messages out of order? msg.time=${msg.time} but last sync was ${this.lastSyncTimestep}`);
  
        if (msg.type === "partial" && (this.timestep - msg.time) > PARTIAL_SYNC_FREQ * 2) {
          // Got a sync message from a long time ago, so that means
          // we are running pretty behind. Ignore this one so because
          // there's probably another one in the queue!
          console.log(`[${this.timestep}] Ignoring partial sync from ${msg.time}`);
          return;
        }
        if (msg.time > this.timestep) {
          // Message is from the future! Catch up to it
          this.replayTo(msg.time);
        }
        this.restoreApplyReplay(
          msg.time,
          () => msg.type === "full" ? this.game.mergeFull(msg.payload) : this.game.mergePartial(msg.payload)
        );
        this.lastSyncTimestep = msg.time;
      } else if (msg.type === "input") {
        if (msg.playerId !== this.playerId) {
          // We can ignore player events from ourselves, as we've already applied
          // those locally.  
          if (msg.time > this.lastSyncTimestep) {
            // We can also ignore input events from before the last
            // sync time step, because the last sync time step had already incorporated
            // the effect of this event.
            this.savePlayerEvent(msg);
            this.restoreApplyReplay(
              msg.time,
              // Don't need to do anything; input will be applied
              () => 0
            );
          } else {
            console.log(`[${this.timestep}] skipping obsolete input event...`)
          }
        }
      } else if (msg.type === "init") {
        // handled before engine creation
      } else if (msg.type === "reset") {
        this.reset();
        this.game.mergeFull(msg.paylod);
        this.initialTimeStep = this.timestep = this.lastSyncTimestep = msg.time;
      } else if (msg.type === "meta") {
        this.game.mergeMeta(msg.payload);
      }
    });
  }

  timerStep() {
    runInAction(() => {
      // If there are player inputs from the future, apply them now
      // before we step
      this.applyPlayerInputsAt(m => m.time === this.timestep && m.playerId !== this.playerId);
  
      super.timerStep();
  
      // Garbage collect snapshots
      if (this.timestep % CLIENT_SNAPSHOT_GC_FREQ === 0) {
        this.garbageCollect(CLIENT_SNAPSHOT_GC_FREQ);
      }
    });
  }

  get playerId() {
    return this.socket.id;
  }

  get isPlaying() {
    return !!this.selfLander;
  }

  get selfLander() {
    return this.game.landers.find(l => l.id === this.socket.id);
  }

  joinGame(opts: {
    name: string
  }) {
    this.sendMessage({
      type: "join",
      gameId: this.game.id,
      time: this.timestep,
      name: opts.name
    });
  }

  resetGame() {
    this.sendMessage({
      type: "request-reset",
      gameId: this.game.id,
      time: this.timestep,
    });
  }

  cancelResetGame() {
    this.sendMessage({
      type: "cancel-reset",
      gameId: this.game.id,
      time: this.timestep,
    });
  }
}
