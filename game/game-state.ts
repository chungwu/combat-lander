import { EventQueue, Vector2, World } from "@dimforge/rapier2d";
import { Ground } from "./objects/ground";
import { Lander } from "./objects/lander";
import { Moon, generateRandomMap } from "./map";
import { GameInputEvent } from "@/messages";
import { Rocket } from "./rocket";
import assert from "assert";
import { isServer } from "@/utils/utils";
import { addVector, rotateVector, scaleVector } from "@/utils/math";
import { Sky } from "./objects/sky";

export class LanderGameState {
  public landers: Lander[];
  public rockets: Rocket[];
  public ground: Ground;
  public sky: Sky;

  static createNew() {
    const moon = generateRandomMap();
    const world = new World(new Vector2(0, moon.gravity));
    return new LanderGameState(moon, world);
  }

  static createFromFull(opts: ReturnType<typeof LanderGameState.prototype.serializeFull>) {
    const state = new LanderGameState(opts.moon, opts.world);
    for (const lander of opts.landers) {
      state.landers.push(Lander.createFrom(opts.world, lander));
    }
    state.ground.mergeFrom(opts.world, opts.ground);
    state.sky.mergeFrom(opts.world, opts.sky)
    return state;
  }

  private constructor(
    public moon: Moon,
    public world: World,
  ) {
    this.ground = Ground.create(this);
    this.sky = Sky.create(this);
    this.landers = [];
    this.rockets = [];
  }

  step() {
    const world = this.world;
    for (const steppable of this.steppables()) {
      steppable.preStep(world.timestep);
    }

    const queue = new EventQueue(true);
    this.world.step(queue);
    
    for (const steppable of this.steppables()) {
      steppable.postStep(world.timestep);
      steppable.wrapTranslation(this.moon.worldWidth);
    }
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
    if (lander) {
      if (event.type === "fire-rocket") {
        assert(isServer(), "Can only handle fire-rocket on the server");
        const rocket = Rocket.create(
          this, lander, { rocketType: event.rocketType }
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
        new Vector2(0, -lander.radius - rocketRadius * 2), 
        landerAngle
      )
    );

    rocket.body.setTranslation(pos, true);
    rocket.body.setLinvel(landerVelocity, true);
    rocket.body.setRotation(landerAngle, true);

    const impulse = new Vector2(0, -15000);
    rocket.body.applyImpulse(rotateVector(scaleVector(impulse, 5), landerAngle), true);
    lander.body.applyImpulse(rotateVector(scaleVector(impulse, -1), landerAngle), true);
  }

  serializeFull() {
    return {
      moon: this.moon,
      world: this.world,
      ground: this.ground.serialize(),
      sky: this.sky.serialize(),
      landers: this.landers.map(l => l.serialize()),
      rockets: this.rockets.map(r => r.serialize()),
    };
  }

  serializePartial() {
    return {
      world: this.world,
      landers: this.landers.map(l => l.serialize()),
      rockets: this.rockets.map(r => r.serialize()),
    };
  }

  mergeFull(payload: ReturnType<typeof this.serializeFull>) {
    const prevWorld = this.world;
    this.moon = payload.moon;
    this.world = payload.world;
    this.ground.mergeFrom(this.world, payload.ground);
    this.sky.mergeFrom(this.world, payload.sky);
    this.mergeLanders(payload.landers);
    this.mergeRockets(payload.rockets);
  }

  mergePartial(payload: ReturnType<typeof this.serializePartial>) {
    this.world = payload.world;
    this.ground.updateCollider(this.world);
    this.sky.updateCollider(this.world);
    this.mergeLanders(payload.landers);
    this.mergeRockets(payload.rockets);
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
  }
}
