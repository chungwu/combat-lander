import { GameInputEvent } from "@/messages";
import { addVector, rotateVector, scaleVector, vectorMagnitude } from "@/utils/math";
import { isServer } from "@/utils/utils";
import { EventQueue, Vector2, World } from "@dimforge/rapier2d";
import assert from "assert";
import pull from "lodash/pull";
import { makeObservable, observable } from "mobx";
import { ROCKET_IMPULSE } from "./constants";
import { Moon, generateRandomMap } from "./map";
import { Ground } from "./objects/ground";
import { Lander } from "./objects/lander";
import { Sky } from "./objects/sky";
import { Rocket } from "./rocket";
import { nanoid } from "nanoid";
import { GameObject } from "./objects/game-object";

export class LanderGameState {
  public landers: Lander[];
  public rockets: Rocket[];
  public ground: Ground;
  public sky: Sky;
  public resetTimestamp: number | undefined;
  private eventQueue: EventQueue = new EventQueue(true);

  static createNew() {
    const moon = generateRandomMap();
    const world = new World(new Vector2(0, moon.gravity));
    world.numSolverIterations = 1;
    return new LanderGameState(nanoid(), moon, world);
  }

  static createFromFull(opts: ReturnType<typeof LanderGameState.prototype.serializeFull>) {
    const state = new LanderGameState(opts.id, opts.moon, opts.world);
    for (const lander of opts.landers) {
      state.landers.push(Lander.createFrom(opts.world, lander));
    }
    state.ground.mergeFrom(opts.world, opts.ground);
    state.sky.mergeFrom(opts.world, opts.sky)
    return state;
  }

  private constructor(
    public id: string,
    public moon: Moon,
    public world: World,
  ) {
    this.ground = Ground.create(this);
    this.sky = Sky.create(this);
    this.landers = [];
    this.rockets = [];
    this.resetTimestamp = undefined;
    makeObservable(this, {
      landers: observable,
      rockets: observable,
      resetTimestamp: observable,
    });
  }

  step() {
    const world = this.world;
    const dt = world.timestep;
    for (const steppable of this.steppables()) {
      steppable.preStep(dt);
    }

    this.world.step(this.eventQueue);

    const colliders = this.buildColliderMap();
    this.eventQueue.drainContactForceEvents(event => {
      const force = event.maxForceMagnitude() * 0.001;
      const processCollision = (lander: Lander, obj: GameObject) => {
        if (!lander.isAlive()) {
          return;
        }
        if (obj instanceof Ground) {
          lander.takeDamage(force * dt * 2)
        } else if (obj instanceof Sky) {
          lander.takeDamage(force * dt * 0.1)
        } else if (obj instanceof Rocket) {
          lander.takeDamage(force * dt * 0.5)
        } else if (obj instanceof Lander) {
          lander.takeDamage(force * dt * 1)
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
      steppable.postStep(dt);
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
    assert(isServer(), `Can only remove game objects on the server`);
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

  applyPlayerInput(playerId: string, event: GameInputEvent) {
    const lander = this.landers.find(l => l.id === playerId);
    if (lander && lander.isAlive()) {
      if (event.type === "fire-rocket") {
        assert(isServer(), "Can only handle fire-rocket on the server");
        const rocket = Rocket.create(
          this, lander, { rocketType: event.rocketType, }
        );
        this.rockets.push(rocket);
        this.fireRocket(lander, rocket);
      } else {
        lander.processInput(event);
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
    const impulse = new Vector2(0, ROCKET_IMPULSE);
    rocket.body.applyImpulse(rotateVector(scaleVector(impulse, -5), landerAngle), true);
    lander.body.applyImpulse(rotateVector(scaleVector(impulse, 1), landerAngle), true);
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
      resetTimestamp: this.resetTimestamp,
    };
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
      resetTimestamp: this.resetTimestamp
    };
  }

  mergeFull(payload: ReturnType<typeof this.serializeFull>) {
    const prevWorld = this.world;
    this.id = payload.id;
    this.moon = payload.moon;
    this.world = payload.world;
    this.ground.mergeFrom(this.world, payload.ground);
    this.sky.mergeFrom(this.world, payload.sky);
    this.mergeLanders(payload.landers);
    this.mergeRockets(payload.rockets);
    this.resetTimestamp = payload.resetTimestamp;
  }

  mergePartial(payload: ReturnType<typeof this.serializePartial>) {
    this.id = payload.id;
    this.world = payload.world;
    this.ground.updateCollider(this.world, this.ground.handle);
    this.sky.updateCollider(this.world, this.sky.handle);
    this.mergeLanders(payload.landers);
    this.mergeRockets(payload.rockets);
  }

  mergeMeta(payload: ReturnType<typeof this.serializeMeta>) {
    this.id = payload.id;
    this.resetTimestamp = payload.resetTimestamp;
  }

  mergeLanders(fromLanders: ReturnType<typeof this.serializeFull>["landers"]) {
    for (const fromLander of fromLanders) {
      let curLander = this.landers.find(l => l.id === fromLander.id);
      if (!curLander) {
        curLander = Lander.createFrom(this.world, fromLander);
        this.landers.push(curLander);
      } else {
        curLander.mergeFrom(this.world, fromLander);
      }
    }

    // We also remove landers not in `fromLanders`. This is safe to do, and
    // there's never any "valid" landers locally that's not in `fromLanders`,
    // because we never create them locally
    const validLanderIds = fromLanders.map(l => l.id);
    const staleLanders = this.landers.filter(l => !validLanderIds.includes(l.id));
    pull(this.landers, ...staleLanders);
  }

  mergeRockets(fromRockets: ReturnType<typeof this.serializeFull>["rockets"]) {
    for (const fromRocket of fromRockets) {
      let curRocket = this.rockets.find(r => r.id === fromRocket.id);
      if (!curRocket) {
        curRocket = Rocket.createFrom(this.world, fromRocket);
        this.rockets.push(curRocket);
      } else {
        curRocket.mergeFrom(this.world, fromRocket);
      }
    }

    const validRocketIds = fromRockets.map(r => r.id);
    const staleRockets = this.rockets.filter(r => !validRocketIds.includes(r.id));
    pull(this.rockets, ...staleRockets);
  }
}
