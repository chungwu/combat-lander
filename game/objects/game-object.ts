import { ensure } from "@/utils/utils";
import { Collider, ColliderDesc, RigidBody, Vector2, World } from "@dimforge/rapier2d";

export abstract class GameObject {
  constructor(
    public collider: Collider
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

  updateCollider(world: World) {
    const collider = world.getCollider(this.handle);
    if (!collider) {
      throw new Error(`NO COLLIDER FOUND!!! ${this.handle}`);
    }
    this.collider = collider;
  }

  preStep(dt: number) {

  }

  postStep(dt: number) {
  }

  wrapTranslation(worldWidth: number) {
    if (this.translation.x < 0) {
      this.body.setTranslation(new Vector2(this.translation.x + worldWidth, this.translation.y), true);
    } else if (this.translation.x > worldWidth) {
      this.body.setTranslation(new Vector2(this.translation.x - worldWidth, this.translation.y), true);
    }
  }
}