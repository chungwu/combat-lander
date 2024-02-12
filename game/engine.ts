import { FullSerializedGameState, GameInputEvent, PlayerInputMessage } from "@/messages";
import { LanderGameState } from "./game-state";
import { PACKR } from "./packr";
import assert from "assert";

export class BaseLanderEngine {
  protected initialTimeStep = 0;
  protected firstStepTime = 0;
  public timestep = 0;
  protected snapshots: GameSnapshot[] = [];
  protected playerInputs: PlayerInputMessage[] = [];

  constructor(
    protected game: LanderGameState,
    protected snapshotFreq: number,
  ) {}

  protected reset() {
    this.timestep = 0;
    this.initialTimeStep = 0;
    this.firstStepTime = 0;
    this.snapshots.splice(0, this.snapshots.length);
    this.playerInputs.splice(0, this.playerInputs.length);
  }

  timerStep() {
    const now = performance.now();
    if (this.firstStepTime === 0) {
      this.firstStepTime = now;
      this.stepOne();
    } else {
      this.stepOne();
      const expectedTimestep = Math.floor((now - this.firstStepTime) / STEP_INTERVAL_MS) + this.initialTimeStep;
      while (this.timestep < expectedTimestep) {
        console.log(`[${this.timestep}] Expected ${expectedTimestep}; catching up`);
        this.stepOne();
      }
    }
  }

  protected preStepOne() {
    this.applyPlayerInputsAt(m => m.time === this.timestep);
  }

  protected postStepOne() {

  }

  protected stepOne() {
    this.preStepOne();
    this.game.step();
    this.timestep += 1;
    this.postStepOne();
    if (this.timestep % this.snapshotFreq === 0) {
      this.saveSnapshot();
    }
  }

  protected restoreApplyReplay(restoreTime: number, func: () => void) {
    const curTime = this.timestep;
    if (curTime === restoreTime) {
      func();
      return true;
    } else {
      console.log(`[${this.timestep}] RESTORING TO ${restoreTime} FROM ${curTime}`);
      if (this.restoreSnapshotTo(restoreTime)) {
        func();
        this.replayTo(curTime);
        console.log(`[${this.timestep}] REPLAYED TO ${curTime}`, this.game.world);
        return true;
      }
      return false;
    }
  }

  protected replayTo(targetTime: number) {
    while (this.timestep < targetTime) {
      this.stepOne();
    }
  }

  protected applyPlayerInputsAt(pred: (msg: PlayerInputMessage) => boolean) {
    this.applyPlayerInputs(this.getPlayerInputsAt(pred));
  }
  
  protected applyPlayerInputs(msgs: PlayerInputMessage[]) {
    for (const msg of msgs) {
      console.log(`[${this.timestep}] APPLYING PLAYER INPUT ${msg.playerId.slice(0, 4)} ${msg.time} ${JSON.stringify(msg.event)}`);
      this.applyPlayerInput(msg.playerId, msg.event);
    }
  }

  protected getPlayerInputsAt(pred: (msg: PlayerInputMessage) => boolean) {
    return this.playerInputs.filter(x => pred(x));
  }

  protected applyPlayerInput(playerId: string, event: GameInputEvent) {
    this.game.applyPlayerInput(playerId, event);
  }

  protected saveSnapshot() {
    const snapshot = {
      time: this.timestep,
      snapshot: PACKR.pack(this.game.serializeFull())
    };
    if (this.snapshots.length > 0 && this.timestep <= this.snapshots[this.snapshots.length - 1].time) {
      const index = this.snapshots.findIndex(s => s.time >= this.timestep);
      assert(index >= 0);
      if (this.snapshots[index].time === this.timestep) {
        this.snapshots[index] = snapshot;
      } else {
        this.snapshots.splice(index, 0, snapshot);
      }
    } else {
      this.snapshots.push(snapshot);
    }
  }

  protected restoreSnapshot(snapshot: GameSnapshot) {
    const game = PACKR.unpack(snapshot.snapshot) as FullSerializedGameState;
    console.log(`[${this.timestep}] Restoring to ${snapshot.time}`, game);
    this.game.mergeFull(game);
    this.timestep = snapshot.time;
  }

  protected restoreSnapshotTo(time: number) {
    const snapshot = this.findClosestSnapshot(time);
    if (snapshot) {
      console.log(`[${this.timestep}] FOUND closest ${snapshot.time}`);
      this.restoreSnapshot(snapshot);
      return true;
    } else {
      return false;
    }
  }

  protected savePlayerEvent(msg: PlayerInputMessage) {
    const index = this.playerInputs.findIndex(x => x.time > msg.time);
    if (index < 0) {
      this.playerInputs.push(msg);
    } else {
      this.playerInputs.splice(index, 0, msg);
    }
  }

  /**
   * Returns closest snapshot that happened _before_ or _at_ this `time`
   */
  protected findClosestSnapshot(time: number) {
    for (let i=this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].time <= time) {
        return this.snapshots[i];
      }
    }
    return undefined;
  }

  /**
   * Removes snapshots or player inputs older than `lookback` steps
   */
  protected garbageCollect(lookback: number) {
    const oldestKept = this.timestep - lookback;
    trimByTime(this.snapshots, oldestKept);
    trimByTime(this.playerInputs, oldestKept);
  }
}


interface GameSnapshot {
  time: number;
  snapshot: Buffer;
}


function trimByTime(timed: {time: number}[], removeOlderThanTime: number) {
  const index = timed.findIndex(x => x.time > removeOlderThanTime);
  if (index > 0) {
    timed.splice(0, index);
  }
}

const STEP_INTERVAL_MS = 1000 / 60; // 60 steps per 1 second