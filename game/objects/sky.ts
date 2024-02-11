import Rapier, { Collider, World } from "@dimforge/rapier2d";
import { LanderGameState } from "../game-state";
import { GameObject } from "./game-object";

export class Sky extends GameObject {
  static create(game: LanderGameState) {
    const body = game.world.createRigidBody(Rapier.RigidBodyDesc.fixed().setTranslation(0, game.moon.worldHeight));
    const colliderDesc = Rapier.ColliderDesc.polyline(new Float32Array([0, 0, game.moon.worldWidth, 0])).setRestitution(1);
    const collider = game.world.createCollider(
      colliderDesc,
      body
    );
    return new Sky(collider);
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
    const collider = world.getCollider(opts.handle);
    this.collider = collider;
  }
}
