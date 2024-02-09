import Rapier, { Collider, Vector, Vector2, World } from "@dimforge/rapier2d";
import { LanderGameState } from "../game-state";
import { GameObject } from "./game-object";
import { FULL_THROTTLE_FORCE, THROTTLE_RATE, TURN_RATE } from "../constants";
import { normalizeAngle, rotateVector } from "@/utils/math";
import pick from "lodash/pick";
import { InputEvent } from "@/messages";

interface LanderOpts {
  id: string;
  name: string;
}

const SERIALIZED_FIELDS = [
  "id", 
  "name", 
  "throttle", "targetRotation", "health", "rotatingLeft", "rotatingRight", "thrustingUp", "thrustingDown"
] as const;
SERIALIZED_FIELDS satisfies readonly (keyof Lander)[];

export class Lander extends GameObject {
  public id: string;
  public name: string;
  public throttle: number = 0;
  public targetRotation: number | null = null;
  public health: number = 0;
  public rotatingLeft = false;
  public rotatingRight = false;
  public thrustingUp = false;
  public thrustingDown = false;

  static create(game: LanderGameState, opts: LanderOpts & { startingLocation: Vector }) {
    const body = game.world.createRigidBody(
      Rapier.RigidBodyDesc.dynamic()
      .setTranslation(opts.startingLocation.x, opts.startingLocation.y)
    );
    const colliderDesc = Rapier.ColliderDesc.ball(10).setRestitution(0.7);
    const collider = game.world.createCollider(
      colliderDesc,
      body
    );
    return new Lander(collider, opts);
  }

  static createFrom(world: World, opts: ReturnType<typeof Lander.prototype.serialize>) {
    const collider = world.getCollider(opts.handle);
    return new Lander(collider, { id: opts.id, name: opts.name });
  }

  constructor(collider: Collider, opts: LanderOpts) {
    super(collider);
    this.id = opts.id;
    this.name = opts.name;
  }

  serialize() {
    return {
      handle: this.handle,
      ...pick(this, ...SERIALIZED_FIELDS),
    };
  }

  mergeFrom(world: World, data: ReturnType<typeof this.serialize>) {
    Object.assign(this, pick(data, ...SERIALIZED_FIELDS));
    const collider = world.getCollider(data.handle);
    this.collider = collider;
  }

  processInput(event: InputEvent) {
    if (event.type === "keyup" || event.type === "keydown") {
      const isOn = event.type === "keydown";
      if (event.key === "up") {
        this.thrustingUp = isOn;
      } else if (event.key === "down") {
        this.thrustingDown = isOn;
      } else if (event.key === "left") {
        this.rotatingLeft = isOn;
      } else if (event.key === "right") {
        this.rotatingRight = isOn;
      }
    }
  }

  preStep(dt: number) {
    super.preStep(dt);

    // Set target rotation
    const rotation = this.rotation;
    if (this.rotatingLeft || this.rotatingRight) {
      let target = this.rotation + TURN_RATE * dt * (this.rotatingLeft ? 1 : -1);
      if (rotation < 0 && target > 0 || rotation > 0 && target < 0) {
        target = 0;
      }
      this.targetRotation = normalizeAngle(target);
    } else {
      this.targetRotation = null;
    }

    if (this.thrustingUp || this.thrustingDown) {
      let target = this.throttle + THROTTLE_RATE * dt * (this.thrustingUp ? 1 : -1);
      target = Math.max(0, Math.min(1.0, target));
      this.throttle = target;
    }

    this.body.resetForces(false);
    if (this.throttle !== 0) {
      const force = new Vector2(0, FULL_THROTTLE_FORCE);
      const rotatedForce = rotateVector(force, rotation);
      this.body.addForce(rotatedForce, true);
    }
    
    if (this.targetRotation != null && this.targetRotation !== rotation) {
      // Stop any previous rotation from forces
      this.body.setAngvel(0, true);

      const targetRotation = this.targetRotation;
      let delta = Math.abs(targetRotation - rotation); 
      delta = Math.min(delta, TURN_RATE * dt);
      const sign = ((rotation > targetRotation && rotation - targetRotation < Math.PI) || (rotation < targetRotation && targetRotation
				- rotation > Math.PI)) ? -1.0 : 1.0;
      const newRotation = normalizeAngle(rotation + sign * delta);
      this.body.setRotation(newRotation, true);
    }
  }
}