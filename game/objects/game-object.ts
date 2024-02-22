import { ensure, isServer } from "@/utils/utils";
import { Collider, ColliderDesc, RigidBody, Vector2, World } from "@dimforge/rapier2d";
import { GameOptions, LanderGameState } from "../game-state";
import assert from "assert";

export abstract class GameObject {
  constructor(
    public id: string,
    public collider: Collider,
  ) {

  }

  get handle() {
    return this.body.handle;
  }

  get translation() {
    return this.collider.translation();
  }

  get rotation() {
    return this.collider.rotation();
  }

  get body() {
    return ensure(this.collider.parent());
  }

  get x() {
    return this.translation.x;
  }

  get y() {
    return this.translation.y;
  }

  updateCollider(world: World, handle: number) {
    const collider = world.getCollider(handle);
    if (!collider) {
      throw new Error(`NO COLLIDER FOUND!!! ${handle}`);
    }
    this.collider = collider;
  }

  preStep(dt: number, timestep: number, options: GameOptions) {

  }

  postStep(dt: number, timestep: number, options: GameOptions) {
  }

  wrapTranslation(worldWidth: number) {
    if (this.translation.x < 0) {
      this.body.setTranslation(new Vector2(this.translation.x + worldWidth, this.translation.y), true);
    } else if (this.translation.x > worldWidth) {
      this.body.setTranslation(new Vector2(this.translation.x - worldWidth, this.translation.y), true);
    }
  }

  maybeRemove(game: LanderGameState) {
    return false;
  }
}