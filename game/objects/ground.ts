import Rapier, { Collider, World } from "@dimforge/rapier2d";
import flatten from "lodash/flatten";
import { Moon } from "../map";
import { GameObject } from "./game-object";
import { nanoid } from "nanoid";
import pick from "lodash/pick";

const SERIALIZED_FIELDS = [
  "id", 
] as const;
SERIALIZED_FIELDS satisfies readonly (keyof Ground)[];

export class Ground extends GameObject {
  static create(world: World, moon: Moon) {
    const body = world.createRigidBody(Rapier.RigidBodyDesc.fixed().setTranslation(0, 0));
    const colliderDesc = Rapier.ColliderDesc.polyline(new Float32Array(flatten(moon.vertices)));
    const collider = world.createCollider(
      colliderDesc,
      body
    );
    return new Ground(nanoid(), collider);
  }

  static createFrom(world: World, payload: ReturnType<typeof Ground.prototype.serialize>) {
    const collider = world.getCollider(payload.handle);
    return new Ground(payload.id, collider);
  }

  constructor(id: string, collider: Collider) {
    super(id, collider);
  }

  serialize() {
    return {
      id: this.id,
      handle: this.handle,
    };
  }

  mergeFrom(world: World, opts: ReturnType<typeof this.serialize>) {
    Object.assign(this, pick(opts, ...SERIALIZED_FIELDS));
    this.updateCollider(world, opts.handle);
  }
}
