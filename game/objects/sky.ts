import Rapier, { Collider, World } from "@dimforge/rapier2d";
import { Moon } from "../map";
import { GameObject } from "./game-object";
import { nanoid } from "nanoid";

export class Sky extends GameObject {
  static create(world: World, moon: Moon) {
    const body = world.createRigidBody(Rapier.RigidBodyDesc.fixed().setTranslation(0, moon.worldHeight));
    const colliderDesc = Rapier.ColliderDesc.polyline(new Float32Array([0, 0, moon.worldWidth, 0])).setRestitution(1);
    const collider = world.createCollider(
      colliderDesc,
      body
    );
    return new Sky(nanoid(), collider);
  }

  static createFrom(world: World, payload: ReturnType<typeof Sky.prototype.serialize>) {
    return new Sky(payload.id, world.getCollider(payload.handle));
  }

  constructor(id: string, collider: Collider) {
    super(id, collider);
  }

  serialize() {
    return {
      id: this.id,
      handle: this.handle
    };
  }

  mergeFrom(world: World, opts: ReturnType<typeof this.serialize>) {
    this.updateCollider(world, opts.handle);
  }
}
