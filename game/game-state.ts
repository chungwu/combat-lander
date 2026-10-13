import { GameInputEvent } from "@/messages";
import { addVector, rotateVector, scaleVector, vectorDistance } from "@/utils/math";
import { ArrayElementType, ensure, isServer } from "@/utils/utils";
import { EventQueue, Vector2, World } from "@dimforge/rapier2d";
import assert from "assert";
import pull from "lodash/pull";
import { makeObservable, observable } from "mobx";
import { CONTACT_DAMAGE_FACTOR, LANDING_PAD_STATS, LANDING_SAFE_ROTATION, LANDING_SAFE_VX, LANDING_SAFE_VY, ROCKET_STATS, STEPS_PER_SECOND } from "./constants";
import { Moon, generateRandomMap } from "./map";
import { Ground } from "./objects/ground";
import { Lander } from "./objects/lander";
import { Sky } from "./objects/sky";
import { Rocket } from "./rocket";
import { nanoid } from "nanoid";
import { GameObject } from "./objects/game-object";
import { LandingPad } from "./objects/landing-pad";
import { minBy } from "lodash";

export interface GameOptions {
  infiniteHealth: boolean;
  infiniteFuel: boolean;
}

export type WinningPlayer = {
  playerId: string;
  reason: "landed";
  landedStats: {
    vx: number;
    vy: number;
    rotation: number;
  }
} | {
  playerId: string;
  reason: "last-lander";
}

export class LanderGameState {
  
  public wonPlayer: WinningPlayer | undefined;
  public playerWins: Record<string, number> = {};
  private eventQueue: EventQueue = new EventQueue(true);

  static createNew(opts: {
    options: GameOptions, 
    moon?: Moon
  }) {
    const moon = opts.moon ?? generateRandomMap();
    const world = new World(new Vector2(0, moon.gravity));
    world.timestep = 1 / STEPS_PER_SECOND;
    world.numSolverIterations = 1;
    const game = new LanderGameState(
      nanoid(), 
      moon, 
      world,
      Ground.create(world, moon),
      Sky.create(world, moon),
      moon.landingPads.map((pad, i) => LandingPad.create(world, moon, i)),
      [],
      [],
      opts.options,
    );
    return game;
  }

  static createFromFull(payload: ReturnType<typeof LanderGameState.prototype.serializeFull>) {
    const { id, moon, world } = payload;

    const game = new LanderGameState(
      id, moon, world,
      Ground.createFrom(world, payload.ground),
      Sky.createFrom(world, payload.sky),
      payload.landingPads.map((padPayload, i) => LandingPad.createFrom(world, moon, i, padPayload)),
      payload.landers.map(l => Lander.createFrom(world, l)),
      payload.rockets.map(r => Rocket.createFrom(world, r)),
      payload.options
    );
    return game;
  }

  private constructor(
    public id: string,
    public moon: Moon,
    public world: World,
    public ground: Ground,
    public sky: Sky,
    public landingPads: LandingPad[],
    public landers: Lander[],
    public rockets: Rocket[],
    public options: GameOptions,
  ) {
    this.wonPlayer = undefined;
    makeObservable(this, {
      landers: observable,
      rockets: observable,
      wonPlayer: observable,
      playerWins: observable,
    });
  }

  step(timestep: number) {
    if (this.wonPlayer) {
      return;
    }

    const world = this.world;
    const dt = world.timestep;
    for (const steppable of this.steppables()) {
      steppable.preStep(dt, timestep, this.options);
    }

    this.world.step(this.eventQueue);

    const colliders = this.buildColliderMap();
    this.eventQueue.drainContactForceEvents(event => {
      const force = event.maxForceMagnitude() * 0.001;
      const processCollision = (lander: Lander, obj: GameObject) => {
        if (!lander.isAlive() || lander.id === this.wonPlayer?.playerId) {
          // No more damage if you've won
          return;
        }
        if (obj instanceof Ground) {
          lander.takeDamage(force * dt * CONTACT_DAMAGE_FACTOR.ground, this.options)
        } else if (obj instanceof Sky) {
          lander.takeDamage(force * dt * CONTACT_DAMAGE_FACTOR.sky, this.options)
        } else if (obj instanceof Rocket) {
          lander.takeDamage(force * dt * CONTACT_DAMAGE_FACTOR.rocket, this.options)
        } else if (obj instanceof Lander) {
          lander.takeDamage(force * dt * CONTACT_DAMAGE_FACTOR.lander, this.options)
        }
      };

      const obj1 = colliders.get(event.collider1());
      const obj2 = colliders.get(event.collider2());
      if (obj1 && obj2) {
        if (obj1 instanceof Lander) {
          processCollision(obj1, obj2);
        }
        if (obj2 instanceof Lander) {
          processCollision(obj2, obj1);
        }
      }
    });

    for (const steppable of this.steppables()) {
      steppable.postStep(dt, timestep, this.options);
      steppable.wrapTranslation(this.moon.worldWidth);
    }
  }

  private buildColliderMap() {
    const map = new Map<number, GameObject>();
    map.set(this.ground.handle, this.ground);
    map.set(this.sky.handle, this.sky);
    for (const steppable of this.steppables()) {
      map.set(steppable.handle, steppable);
    }
    return map;
  }

  

  maybeRemoveObjects() {
    let removed = false;
    for (const steppable of this.steppables()) {
      if (steppable.maybeRemove(this)) {
        removed = true;
      }
    }
    return removed;
  }

  *steppables() {
    for (const lander of this.landers) {
      yield lander;
    }
    for (const rocket of this.rockets) {
      yield rocket;
    }
  }

  applyPlayerInput(playerId: string, event: GameInputEvent, timestep: number) {
    if (event.type === "joined") {
      if (this.landers.find(l => l.id === event.playerId)) {
        // Right now this is a bit yucky, but... the player join event is at the same
        // timestep as the sync message that includes that joined player. Usually
        // the effect of an event is only seen at the next timestep. So, this might
        // happen, and we just ignore it for now!
      } else {
        const lander = Lander.create(this, {
          id: event.playerId,
          name: event.name,
          color: event.color,
          startingLocation: new Vector2(event.startX, event.startY),
        });
        this.landers.push(lander);
      }
    } else {
      const lander = this.landers.find(l => l.id === playerId);
      if (lander && lander.isAlive()) {
        if (event.type === "fire-rocket") {
          if (this.rockets.find(r => r.id === event.id)) {
            // This is yucky for the same reason as duplicate lander above...
          } else if (lander.rocketState[event.rocketType].count > 0) {
            const rocket = Rocket.create(
              this, lander, { rocketType: event.rocketType, id: event.id }
            );
            this.rockets.push(rocket);
            this.fireRocket(lander, rocket);
            lander.rocketState[event.rocketType].count -= 1;
            lander.rocketState[event.rocketType].replenishFromTimestep = timestep;
          }
        } else {
          lander.processInput(event);
        }
      }
    }
  }

  private fireRocket(lander: Lander, rocket: Rocket) {
    const landerPos = lander.translation;
    const landerVelocity = lander.body.linvel();
    const landerAngle = lander.rotation;
    const rocketRadius = rocket.radius;
    const pos = addVector(
      landerPos, 
      rotateVector(
        new Vector2(0, -lander.radius - rocketRadius - 2), 
        landerAngle
      )
    );

    rocket.body.setTranslation(pos, true);
    rocket.body.setLinvel(landerVelocity, true);
    rocket.body.setRotation(landerAngle, true);

    // We apply more impulse on the rocket than the lander,
    // because the rockets are already physically unrealistic
    // (their mass and size is similar to a lander's) so we need
    // disporportionally more impulse on it to fire it away
    const impulse = new Vector2(0, ROCKET_STATS[rocket.rocketType].impulse);
    rocket.body.applyImpulse(rotateVector(scaleVector(impulse, -5), landerAngle), true);
    lander.body.applyImpulse(rotateVector(scaleVector(impulse, 1), landerAngle), true);
  }

  findClosestPad(lander: Lander) {
    return minBy(this.landingPads, pad => vectorDistance(pad.translation, lander.translation))!;
  }

  isSafelyLanded(lander: Lander) {
    const pad = this.findClosestPad(lander);
    if (
      lander.x - lander.radius >= pad.x && 
      lander.x + lander.radius <= pad.x + LANDING_PAD_STATS[pad.type].width &&
      this.world.intersectionPair(lander.collider, pad.collider) &&
      Math.abs(lander.rotation) <= LANDING_SAFE_ROTATION &&
      Math.abs(lander.body.linvel().x) <= LANDING_SAFE_VX &&
      Math.abs(lander.body.linvel().y) <= LANDING_SAFE_VY
    ) {
      return pad;
    }
    return undefined;
  }

  addWins(playerId: string, wins: number) {
    const num = this.playerWins[playerId] ?? 0;
    this.playerWins[playerId] = num + wins;
  }

  serializeFull() {
    return {
      id: this.id,
      moon: this.moon,
      world: this.world,
      ground: this.ground.serialize(),
      sky: this.sky.serialize(),
      landers: this.landers.map(l => l.serialize()),
      rockets: this.rockets.map(r => r.serialize()),
      landingPads: this.landingPads.map(l => l.serialize()),
      wonPlayer: this.wonPlayer,
      playerWins: this.playerWins,
      options: this.options,
    };
  }

  mergeSnapshot(snapshot: ReturnType<typeof this.takeSnapshot>) {
    const snapshot2 = {
      ...snapshot,
      world: World.restoreSnapshot(snapshot.world)
    };
    this.mergePartial(snapshot2);
  }

  takeSnapshot() {
    return {
      ...this.serializePartial(),
      world: this.world.takeSnapshot()
    }
  }

  serializePartial() {
    return {
      id: this.id,
      world: this.world,
      landers: this.landers.map(l => l.serialize()),
      rockets: this.rockets.map(r => r.serialize()),
    };
  }

  serializeMeta() {
    return {
      id: this.id,
      wonPlayer: this.wonPlayer,
      playerWins: this.playerWins,
    };
  }

  /**
   * Called static things like the `moon` itself has changed. 
   * `payload.world` may be different and have different handles 
   * from `this.world`.
   */
  mergeFull(payload: ReturnType<typeof this.serializeFull>) {
    const prevWorld = this.world;
    this.id = payload.id;
    this.options = payload.options;
    this.moon = payload.moon;
    this.world = payload.world;
    this.ground.mergeFrom(this.world, payload.ground);
    this.sky.mergeFrom(this.world, payload.sky);
    this.mergeLanders(payload.landers);
    this.mergeRockets(payload.rockets);
    for (let i=0; i<payload.landingPads.length; i++) {
      this.landingPads[i].mergeFrom(this.world, payload.landingPads[i]);
    }

    this.wonPlayer = payload.wonPlayer;
    this.playerWins = payload.playerWins;
    prevWorld.free();
  }

  mergePartial(payload: ReturnType<typeof this.serializePartial>) {
    const prevWorld = this.world;
    this.id = payload.id;
    this.world = payload.world;
    this.ground.updateCollider(this.world, this.ground.handle);
    this.sky.updateCollider(this.world, this.sky.handle);
    this.mergeLanders(payload.landers);
    this.mergeRockets(payload.rockets);
    for (const pad of this.landingPads) {
      pad.updateCollider(this.world, pad.handle);
    }
    prevWorld.free();
  }

  mergeMeta(payload: ReturnType<typeof this.serializeMeta>) {
    this.id = payload.id;
    this.wonPlayer = payload.wonPlayer;
    this.playerWins = payload.playerWins;
  }

  mergeLanders(fromLanders: ReturnType<typeof this.serializeFull>["landers"]) {
    this.mergeObjects(
      "landers",
      fromLanders,
      (fromLander) => Lander.createFrom(this.world, fromLander),
    );
  }

  mergeRockets(fromRockets: ReturnType<typeof this.serializeFull>["rockets"]) {
    this.mergeObjects(
      "rockets", fromRockets,
      (fromObj) => Rocket.createFrom(this.world, fromObj),
    );
  }

  mergeObjects<ObjectsField extends "rockets"|"landers">(
    field: ObjectsField,
    fromObjs: ReturnType<typeof this.serializeFull>[ObjectsField],
    createFrom: (fromObj: ArrayElementType<ReturnType<typeof this.serializeFull>[ObjectsField]>) => any,
  ) {
    for (const fromObj of fromObjs) {
      const cur = this[field].find(x => x.id === fromObj.id);
      if (!cur) {
        const newObj = createFrom(fromObj as any);
        this[field].push(newObj);
      } else {
        cur.mergeFrom(this.world, fromObj as any);
      }
    }

    // We also remove objects not in `fromObjects`. Careful; we do this because we
    // consider fromObjs to be authoratative. But when restoring snapshots, you may
    // end up with a snapshot that has fewer objects than the current state, so 
    // you need to make sure your reply will add those objects back in (for example,
    // players joining and rockets being fired).
    const validIds = fromObjs.map(x => x.id);
    const staleObjs = this[field].filter(r => !validIds.includes(r.id));
    pull(this[field], ...staleObjs);
  }
}
