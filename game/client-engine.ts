import { ChatMessage, ClientMessage, GameInputEvent, PartialSyncMessage, PlayerInputMessage, ResetOptions, ResetPendingMessage, ServerMessage } from "@/messages";
import PartySocket from "partysocket";
import { GameOptions, LanderGameState } from "./game-state";
import { BaseLanderEngine, GameSnapshot } from "./engine";
import assert from "assert";
import { CLIENT_SNAPSHOT_FREQ, CLIENT_SNAPSHOT_GC_FREQ, PARTIAL_SYNC_FREQ } from "./constants";
import { computed, makeObservable, observable, runInAction } from "mobx";
import { KeyboardController } from "./controls";
import pull from "lodash/pull";
import { sortBy } from "lodash";

export class ClientLanderEngine extends BaseLanderEngine {
  private lastSyncTimestep: number;
  public controller: KeyboardController;
  public resetPending: ResetPendingMessage | undefined;
  private chatListeners: ((msg: ChatMessage) => void)[] = [];
  private messageQueue: (PartialSyncMessage | PlayerInputMessage)[] = [];
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
      if (msg.type === "partial" && !this.game.wonPlayer) {
        this.messageQueue.push(msg);
      } else if (msg.type === "input") {
        // We can ignore player events from ourselves, as we've already applied
        // those locally.  
        if (msg.playerId !== this.playerId) {
          this.messageQueue.push(msg);
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

  timerStep() {
    runInAction(() => {
      this.processMessageQueue();

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

  private processMessageQueue() {
    const curTime = this.timestep;
    const messages = sortBy(this.messageQueue, m => m.time);

    // Clear the message queue
    this.messageQueue.splice(0, messages.length);

    // first, look for a sync message that we can apply; it will have to
    // be one that we don't outright know is wrong.

    const lastSyncMsg = messages.findLast((m): m is PartialSyncMessage => m.type === "partial");
    if (lastSyncMsg) {
      // We only care about the last sync message, as a previous sync message would
      // be superceded by this one anyway

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
      const lastServerKnownTimesteps = lastSyncMsg.lastPlayerInputTimesteps[this.playerId] ?? [];
      const oldestLastServerKnownTimestep = lastServerKnownTimesteps[0] ?? 0;
      const unseenInputs = this.playerInputs.filter(x => x.playerId === this.playerId && x.time >= oldestLastServerKnownTimestep && x.time <= lastSyncMsg.time && !lastServerKnownTimesteps.includes(x.time));
      if (unseenInputs.length > 0) {
        console.log(`[${this.timestep}] STALE partial sync! Server at ${lastSyncMsg.time} only saw [${lastServerKnownTimesteps.join(", ")}] since last sync, but we have [${unseenInputs.map(x => x.time).join(", ")}]`);
      } else {
        console.log(`[${this.timestep}] Applying sync from ${lastSyncMsg.time}`);
        assert(lastSyncMsg.time >= this.lastSyncTimestep, `[${this.timestep}] Got sync messages out of order? lastSyncMsg.time=${lastSyncMsg.time} but last sync was ${this.lastSyncTimestep}`);
        // Restore to that snapshot
        this.restoreSnapshot({
          time: lastSyncMsg.time,
          snapshot: {
            ...lastSyncMsg.payload,
            world: lastSyncMsg.payload.world.takeSnapshot()
          }
        });
        this.lastSyncTimestep = lastSyncMsg.time;
      }
    }

    const playerInputs = messages.filter((m): m is PlayerInputMessage => m.type === "input");

    // Save all the player inputs
    for (const msg of playerInputs) {
      this.savePlayerEvent(msg);
    }

    // Now replay player inputs and bring us back to current time. What time should we start from?
    // We should start from the playerInput message with the minimum time...  but we can also
    // ignore events from before lastSyncMsg.time, because those inputs should've been
    // already incorporated into the lastSyncMsg
    const fromTime = playerInputs[0]?.time ?? lastSyncMsg?.time;
    if (fromTime != null && playerInputs.some(x => x.time >= fromTime)) {
      this.restoreSnapshotTo(fromTime);
    }
    
    // Now, we just have to replay to the current time, which will also apply the player
    // inputs along the way. One wrinkle is that the lastSyncMsg.time may be in the future!
    // In that case, we will also go ahead and catch up to the future.
    this.replayTo(Math.max(curTime, lastSyncMsg?.time ?? 0));
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
