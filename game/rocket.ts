import { Collider, ColliderDesc, Cuboid, RigidBodyDesc, Vector2, World } from "@dimforge/rapier2d";
import { GameObject } from "./objects/game-object";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import pick from "lodash/pick";
import { nanoid } from "nanoid";
import pull from "lodash/pull";
import { getLanderColor } from "./constants";

export type RocketType = "small" | "big";

const SERIALIZED_FIELDS = [
  "id",
  "ownerLanderId",
  "rocketType", 
  "aliveSteps",
  "color"
] as const;
SERIALIZED_FIELDS satisfies readonly (keyof Rocket)[];

export class Rocket extends GameObject {
  public id: string;
  public rocketType: RocketType;
  public ownerLanderId: string;
  public aliveSteps: number = 0;
  public color: string;

  static create(game: LanderGameState, lander: Lander, opts: {
    rocketType: RocketType;
  }) {
    const type = opts.rocketType;
    const rocketSize = ROCKET_STATS[type].radius;
    const body = game.world.createRigidBody(
      RigidBodyDesc.dynamic()
    );
    const colliderDesc = ColliderDesc.cuboid(rocketSize, rocketSize).setRestitution(0.9).setDensity(1);
    const collider = game.world.createCollider(colliderDesc, body);
    return new Rocket(collider, {
      ownerLanderId:  lander.id,
      rocketType: opts.rocketType,
      color: getLanderColor(lander.color, 7)
    });
  }

  static createFrom(world: World, fromRocket: ReturnType<typeof Rocket.prototype.serialize>) {
    const collider = world.getCollider(fromRocket.handle);
    if (!collider) {
      throw new Error(`NO COLLIDER FOUND!!! ${fromRocket.handle}`)
    }
    console.log(`CREATED ROCKET`, fromRocket.handle, fromRocket);
    return new Rocket(collider, fromRocket);
  }

  constructor(collider: Collider, opts: {
    id?: string;
    ownerLanderId: string;
    rocketType: RocketType;
    color: string;
  }) {
    super(collider);
    this.id = opts.id ?? nanoid();
    this.ownerLanderId = opts.ownerLanderId;
    this.rocketType = opts.rocketType;
    this.color = opts.color;
  }

  postStep(dt: number) {
    super.postStep(dt);
    this.aliveSteps += 1;
  }

  serialize() {
    return {
      handle: this.handle,
      ...pick(this, ...SERIALIZED_FIELDS)
    }
  }

  get radius() {
    return ROCKET_STATS[this.rocketType].radius;
  }

  get shape() {
    return this.collider.shape as Cuboid;
  }

  maybeRemove(game: LanderGameState): boolean {
    if (this.aliveSteps >= ROCKET_STATS[this.rocketType].aliveSteps) {
      pull(game.rockets, this);
      game.world.removeRigidBody(this.body);
      return true;
    }

    return false;
  }

  mergeFrom(world: World, data: ReturnType<typeof this.serialize>) {
    Object.assign(this, pick(data, ...SERIALIZED_FIELDS));
    this.updateCollider(world);
  }
}

const ROCKET_STATS = {
  "small": {
    radius: 10,
    initialVelocity: 40,
    aliveSteps: 60 * 30 // alive for 30s
  },
  "big": {
    radius: 25,
    initialVelocity: 40,
    aliveSteps: 60 * 30
  } as const
};