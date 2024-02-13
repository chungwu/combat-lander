import Rapier, { Collider, World } from "@dimforge/rapier2d";
import flatten from "lodash/flatten";
import { Moon } from "../map";
import { GameObject } from "./game-object";

export class Ground extends GameObject {
  static create(world: World, moon: Moon) {
    const body = world.createRigidBody(Rapier.RigidBodyDesc.fixed().setTranslation(0, 0));
    const colliderDesc = Rapier.ColliderDesc.polyline(new Float32Array(flatten(moon.vertices)));
    const collider = world.createCollider(
      colliderDesc,
      body
    );
    return new Ground(collider);
  }

  static createFrom(world: World, payload: ReturnType<typeof Ground.prototype.serialize>) {
    const collider = world.getCollider(payload.handle);
    return new Ground(collider);
  }

  constructor(collider: Collider) {
    super(collider);
  }

  serialize() {
    return {
      handle: this.handle
    };
  }

  mergeFrom(world: World, opts: ReturnType<typeof this.serialize>) {
    this.updateCollider(world, opts.handle);
  }
}
