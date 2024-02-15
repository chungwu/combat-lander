import { GameInputEvent, PlayerInputMessage } from "@/messages";
import assert from "assert";
import { LanderGameState } from "./game-state";

export class BaseLanderEngine {
  protected initialTimeStep = 0;
  protected firstStepTime = 0;
  public timestep = 0;
  protected snapshots: GameSnapshot[] = [];
  protected playerInputs: PlayerInputMessage[] = [];

  constructor(
    public game: LanderGameState,
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
    this.game.step(this.timestep);
    this.postStepOne();
    this.timestep += 1;
    if (this.timestep % this.snapshotFreq === 0) {
      this.saveSnapshot();
    }
  }

  protected restoreApplyReplay(restoreTime: number, func: () => void) {
    const curTime = this.timestep;
    if (this.restoreSnapshotTo(restoreTime)) {
      func();
      this.replayTo(curTime);
      return true;
    }
    return false;
  }

  protected replayTo(targetTime: number) {
    while (this.timestep < targetTime) {
      this.stepOne();
    }
  }

  protected applyPlayerInputsAt(pred: (msg: PlayerInputMessage) => boolean) {
    for (const msg of this.playerInputs) {
      if (pred(msg)) {
        console.log(`[${this.timestep}] APPLYING PLAYER INPUT ${msg.playerId.slice(0, 4)}@${msg.time} ${JSON.stringify(msg.event)}`);
        this.applyPlayerInput(msg.playerId, msg.event);
      }
    }
  }
  
  protected applyPlayerInput(playerId: string, event: GameInputEvent) {
    this.game.applyPlayerInput(playerId, event, this.timestep);
  }

  protected saveSnapshot() {
    const snapshot = {
      time: this.timestep,
      snapshot: this.game.takeSnapshot()
    };
    this.insertSnapshot(snapshot);
  }

  protected insertSnapshot(snapshot: GameSnapshot) {
    if (this.snapshots.length > 0 && snapshot.time <= this.snapshots[this.snapshots.length - 1].time) {
      // The time for the snapshot is before the latest snapshot we have
      const index = this.snapshots.findIndex(s => s.time >= snapshot.time);
      assert(index >= 0);
      if (this.snapshots[index].time === snapshot.time) {
        this.snapshots[index] = snapshot;
      } else {
        this.snapshots.splice(index, 0, snapshot);
      }
      return index;
    } else {
      this.snapshots.push(snapshot);
      return this.snapshots.length - 1;
    }
  }

  protected restoreSnapshot(snapshot: GameSnapshot) {
    // console.log(`[${this.timestep}] Restoring to ${snapshot.time}`);
    this.game.mergeSnapshot(snapshot.snapshot);
    this.timestep = snapshot.time;
  }

  protected restoreSnapshotTo(time: number) {
    if (time === this.timestep) {
      return true;
    }
    const snapshot = this.findClosestSnapshot(time);
    if (snapshot) {
      // console.log(`[${this.timestep}] FOUND closest ${snapshot.time}`);
      this.restoreSnapshot(snapshot);
      return true;
    } else {
      console.log(`[${this.timestep} FAILED to restore snapshot to ${time}]`);
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
  protected garbageCollect(oldestKept: number) {
    trimByTime(this.snapshots, oldestKept);
    trimByTime(this.playerInputs, oldestKept);
  }
}


interface GameSnapshot {
  time: number;
  snapshot: ReturnType<typeof LanderGameState.prototype.takeSnapshot>;
}


function trimByTime(timed: {time: number}[], removeOlderThanTime: number) {
  const index = timed.findIndex(x => x.time > removeOlderThanTime);
  if (index > 0) {
    timed.splice(0, index);
  }
}

const STEP_INTERVAL_MS = 1000 / 60; // 60 steps per 1 second