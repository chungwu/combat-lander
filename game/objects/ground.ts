import Rapier, { ActiveCollisionTypes, ActiveEvents, Collider, World } from "@dimforge/rapier2d";
import { LanderGameState } from "../game-state";
import { GameObject } from "./game-object";

export class Ground extends GameObject {
  static create(game: LanderGameState) {
    const body = game.world.createRigidBody(Rapier.RigidBodyDesc.fixed().setTranslation(0, 0));
    const colliderDesc = Rapier.ColliderDesc.polyline(new Float32Array(game.moon.vertices));
    const collider = game.world.createCollider(
      colliderDesc,
      body
    );
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
