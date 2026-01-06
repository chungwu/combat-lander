import Rapier, { Collider, World } from "@dimforge/rapier2d";
import { Moon } from "../map";
import { GameObject } from "./game-object";
import { nanoid } from "nanoid";
import { SKY_CEILING_THICKNESS } from "../constants";

export class Sky extends GameObject {
  static create(world: World, moon: Moon) {
    const body = world.createRigidBody(
      Rapier.RigidBodyDesc.fixed().setTranslation(
        moon.worldWidth / 2,
        moon.worldHeight + SKY_CEILING_THICKNESS / 2,
      ),
    );
    const colliderDesc = Rapier.ColliderDesc.cuboid(
      moon.worldWidth / 2,
      SKY_CEILING_THICKNESS / 2,
    ).setRestitution(1);
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
