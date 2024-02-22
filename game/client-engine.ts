import { ChatMessage, ClientMessage, FullSyncMessage, GameInputEvent, PartialSyncMessage, ResetOptions, ResetPendingMessage, ServerMessage } from "@/messages";
import PartySocket from "partysocket";
import { GameOptions, LanderGameState } from "./game-state";
import { BaseLanderEngine } from "./engine";
import assert from "assert";
import { CLIENT_SNAPSHOT_FREQ, CLIENT_SNAPSHOT_GC_FREQ, PARTIAL_SYNC_FREQ } from "./constants";
import { computed, makeObservable, observable, runInAction } from "mobx";
import { KeyboardController } from "./controls";
import pull from "lodash/pull";

export class ClientLanderEngine extends BaseLanderEngine {
  private lastSyncTimestep: number;
  public controller: KeyboardController;
  public resetPending: ResetPendingMessage | undefined;
  private chatListeners: ((msg: ChatMessage) => void)[] = [];
  constructor(
    state: LanderGameState,
    private socket: PartySocket,
    initialTimeStep: number,
  ) {
    super(state, CLIENT_SNAPSHOT_FREQ);
    this.timestep = initialTimeStep;
    this.initialTimeStep = initialTimeStep;
    this.lastSyncTimestep = initialTimeStep;
    this.controller = new KeyboardController(this);
    this.resetPending = undefined;
    makeObservable(this, {
      selfLander: computed,
      timestep: observable,
      resetPending: observable,
    });
  }

  private sendMessage(msg: ClientMessage) {
    console.log(`[${this.timestep}] SENDING: ${msg.type} @ ${msg.time}: ${msg.type === "input" ? JSON.stringify(msg.event) : ""}`)
    this.socket.send(JSON.stringify(msg));
  }

  protected applyPlayerInput(playerId: string, event: GameInputEvent): void {
    if (event.type === "fire-rocket") {
      // We only apply fire-rocket locally; we depend on 
      // server syncs to get other player's rockets
      if (playerId === this.playerId) {
        super.applyPlayerInput(playerId, event);
      }
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
      this.savePlayerEvent(msg);
      this.sendMessage(msg);
    }
  }

  handleMessage(msg: ServerMessage) {
    runInAction(() => {
      if (msg.gameId !== this.game.id && msg.type !== "reset") {
        return;
      }
      console.log(`[${this.timestep}] GOT MESSAGE ${msg.type} @ ${msg.time}`, msg);
      if ((msg.type === "full" || msg.type === "partial") && !this.game.wonPlayer) {
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
        this.applySyncMessage(msg);
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
        this.resetPending = undefined;
      } else if (msg.type === "meta") {
        this.game.mergeMeta(msg.payload);
      } else if (msg.type === "reset-pending") {
        this.resetPending = msg;
      } else if (msg.type === "reset-cancelled") {
        this.resetPending = undefined;
      } else if (msg.type === "chat") {
        this.chatListeners.forEach(l => l(msg));
      }
    });
  }

  protected reset() {
    super.reset();
    this.controller.reset();
  }

  private applySyncMessage(msg: FullSyncMessage | PartialSyncMessage) {
    if (msg.type === "full") {
      // For a full sync, we make it part of our snapshots history, and
      // then play forward from there. This avoids the case where we don't
      // have an existing snapshot with that time step, and so we'd fail
      // to restoreApplyReplay().
      this.insertSnapshot({
        time: msg.time,
        snapshot: {
          ...msg.payload,
          world: msg.payload.world.takeSnapshot()
        }
      });
      // We restore and reply, but don't need to do a merge anymore, as we
      // started from the snapshot we just created. But we forceRestore, so we
      // make sure the snapshot we just inserted will be used, even if it's the
      // same time as now.
      this.restoreApplyReplay(
        msg.time, 
        // Even though restore would restore this snapshot, we explicitly want
        // to do a full merge, not a partial merge, for these full sync messages
        () => this.game.mergeFull(msg.payload)
      );
      this.lastSyncTimestep = msg.time;
    } else {
      const lastServerKnownTimesteps = msg.lastPlayerInputTimesteps[this.playerId] ?? [];
      const oldestLastServerKnownTimestep = lastServerKnownTimesteps[0] ?? 0;
      const unseenInputs = this.playerInputs.filter(x => x.playerId === this.playerId && x.time >= oldestLastServerKnownTimestep && x.time <= msg.time && !lastServerKnownTimesteps.includes(x.time));
      if (unseenInputs.length > 0) {
        // Suppose this sync message reflects the server's state at time 100.
        // But we see that the server last saw an input from us at time 90, and that
        // we have another input at time 95 that the server has not seen yet (due to
        // network issues, etc). In that case, the server's idea of our location will
        // differ from our own, and if we apply this sync, it will be very jarring.
        // So instead, we will wait until we see a server's sync message that incorporates
        // all known inputs from us.
        //
        // This is kind of dangerous as we may end up lagging significantly behind the
        // server, if the server is consistently behind in processing our inputs. But the
        // alternative is to have jarring effects where our lander would jump and and forth.
        //
        // Note also that we are only checking for ourself, not other players. This just
        // makes it easier for this check to pass; it means other players may still "jump"
        // and we ourselves may also still "jump" if we are in contact with other players.
        // But, there's not much we can do there, as we also can't trust that we ourselves
        // have an accurate view of the inputs from other players.
        console.log(`[${this.timestep}] STALE partial sync! Server at ${msg.time} only saw [${lastServerKnownTimesteps.join(", ")}] since last sync, but we have [${unseenInputs.map(x => x.time).join(", ")}]`);
      } else {
        const success = this.restoreApplyReplay(
          msg.time,
          () => {
            this.game.mergePartial(msg.payload);
          }
        );
        if (!success) {
          // If we failed to apply a partial update, because we don't have a
          // snapshot that's old enough, then request a full update
          this.sendMessage({
            type: "request-full",
            time: this.timestep,
            gameId: this.game.id
          });
        }
        this.lastSyncTimestep = msg.time;
      }
    }
  }

  timerStep() {
    runInAction(() => {
      // If there are player inputs from the future, apply them now
      // before we step
      this.applyPlayerInputsAt(m => m.time === this.timestep && m.playerId !== this.playerId);
  
      super.timerStep();
  
      // Garbage collect snapshots
      if (this.timestep % CLIENT_SNAPSHOT_GC_FREQ === 0) {
        this.garbageCollect(this.lastSyncTimestep);
      }
    });
  }

  protected postStepOne(): void {
    super.postStepOne();
    this.game.maybeRemoveObjects();    
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

  resetGame(gameOptions: GameOptions, resetOptions: ResetOptions) {
    this.sendMessage({
      type: "request-reset",
      gameId: this.game.id,
      time: this.timestep,
      options: gameOptions,
      resetOptions: resetOptions
    });
  }

  startGame(name: string, gameOptions: GameOptions) {
    this.sendMessage({
      type: "request-start",
      name,
      gameId: this.game.id,
      time: this.timestep,
      options: gameOptions,
    });
  }

  cancelResetGame() {
    this.sendMessage({
      type: "cancel-reset",
      gameId: this.game.id,
      time: this.timestep,
    });
  }

  setPlayerSettings(opts: {name: string}) {
    this.sendMessage({
      type: "player-info",
      name: opts.name,
      gameId: this.game.id,
      time: this.timestep
    });
  }

  sendChat(opts: { message: string}) {
    this.sendMessage({
      type: "chat",
      gameId: this.game.id,
      time: this.timestep,
      playerId: this.playerId,
      message: opts.message
    });
  }

  addChatListener(listener: (msg: ChatMessage) => void) {
    this.chatListeners.push(listener);
  }

  removeChatListener(listener: (msg: ChatMessage) => void) {
    pull(this.chatListeners, listener);
  }
}
