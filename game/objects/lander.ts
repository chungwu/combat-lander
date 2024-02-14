import Rapier, { ActiveCollisionTypes, ActiveEvents, Ball, Collider, Vector, Vector2, World } from "@dimforge/rapier2d";
import { LanderGameState } from "../game-state";
import { GameObject } from "./game-object";
import { FULL_THROTTLE_FORCE, JOYSTICK_CONFIG, LANDER_RADIUS, LanderColor, ROCKET_STATS, ROTATE_FUEL_BURN_RATE, RocketType, THROTTLE_FUEL_BURN_RATE, THROTTLE_RATE, TURN_RATE } from "../constants";
import { normalizeAngle, rotateVector, vectorMagnitude } from "@/utils/math";
import pick from "lodash/pick";
import { GameInputEvent } from "@/messages";
import assert from "assert";
import { action, makeObservable, observable } from "mobx";

interface LanderOpts {
  id: string;
  name: string;
  color: LanderColor;
}

const SERIALIZED_FIELDS = [
  "id", 
  "name", 
  "color",
  "throttle", "targetRotation", "joystickTarget", 
  "health", "fuel", 
  "rotatingLeft", "rotatingRight", "thrustingUp", "thrustingDown",
  "rocketState",
] as const;
SERIALIZED_FIELDS satisfies readonly (keyof Lander)[];

export class Lander extends GameObject {
  public id: string;
  public name: string;
  public color: LanderColor;
  public throttle: number = 0;
  public joystickTarget: {
    throttle: number;
    rotation: number | null;
  } | undefined = undefined;
  public targetRotation: number | null = null;
  public health: number = 100;
  public fuel: number = 100;
  public rotatingLeft = false;
  public rotatingRight = false;
  public thrustingUp = false;
  public thrustingDown = false;
  public rocketState: Record<RocketType, { count: number, replenishFromTimestep: number}> = {
    "small": {
      count: ROCKET_STATS.small.ammo,
      replenishFromTimestep: 0,
    },
    "big": {
      count: ROCKET_STATS.big.ammo,
      replenishFromTimestep: 0
    }
  };

  static create(game: LanderGameState, opts: LanderOpts & { startingLocation: Vector }) {
    const body = game.world.createRigidBody(
      Rapier.RigidBodyDesc.dynamic()
      .setTranslation(opts.startingLocation.x, opts.startingLocation.y)
    );
    const colliderDesc = Rapier.ColliderDesc.ball(LANDER_RADIUS).setRestitution(0.7).setDensity(1).setActiveEvents(ActiveEvents.CONTACT_FORCE_EVENTS | ActiveEvents.COLLISION_EVENTS).setContactForceEventThreshold(0);
    const collider = game.world.createCollider(
      colliderDesc,
      body
    );
    return new Lander(collider, opts);
  }

  static createFrom(world: World, opts: ReturnType<typeof Lander.prototype.serialize>) {
    const collider = world.getCollider(opts.handle);
    const lander = new Lander(collider, { id: opts.id, name: opts.name, color: opts.color });
    lander.mergeFrom(world, opts);
    return lander;
  }

  constructor(collider: Collider, opts: LanderOpts) {
    super(collider);
    this.id = opts.id;
    this.name = opts.name;
    this.color = opts.color;
    makeObservable(this, {
      health: observable,
      rocketState: observable,
    });
  }

  get radius() {
    const shape = this.collider.shape;
    assert(shape instanceof Ball);
    return shape.radius;
  }

  serialize() {
    return {
      handle: this.handle,
      ...pick(this, ...SERIALIZED_FIELDS),
    };
  }

  mergeFrom(world: World, data: ReturnType<typeof this.serialize>) {
    Object.assign(this, pick(data, ...SERIALIZED_FIELDS));
    this.updateCollider(world, data.handle);
  }

  processInput(event: GameInputEvent) {
    if (this.isAlive()) {
      if (event.type === "thrust") {
        if (event.dir === "up") {
          this.thrustingUp = event.active;
        } else if (event.dir === "down") {
          this.thrustingDown = event.active;
        }
      } else if (event.type === "rotate") {
        if (event.dir === "left") {
          this.rotatingLeft = event.active;
        } else if (event.dir === "right") {
          this.rotatingRight = event.active;
        }
      } else if (event.type === "joystick") {
        const actionThreshold = JOYSTICK_CONFIG.threshold;
        const normed = (val: number) => {
          if (Math.abs(val) < actionThreshold) {
            return 0;
          }
          let magnitude = (Math.abs(val) - actionThreshold) / (1 - actionThreshold);
          magnitude = magnitude * (val > 0 ? 1 : -1);
          return Math.round(magnitude * 10000) / 10000;
        };

        const normY = normed(event.y);
        const normX = normed(event.x);

        if (JOYSTICK_CONFIG.scheme === "mixed") {
          this.throttle = Math.abs(normY);
          
          if (normX < 0) {
            this.rotatingLeft = true;
            this.rotatingRight = false;
          } else if (normX > 0) {
            this.rotatingRight = true;
            this.rotatingLeft = false;
          } else {
            this.rotatingLeft = this.rotatingRight = false;
          }
        } else {
          this.joystickTarget = {
            rotation: Math.abs(event.x) > actionThreshold || Math.abs(event.y) > actionThreshold ? Math.atan2(-normX, normY) : null,
            throttle: Math.abs(normY),
          };
        }
      }
    }
  }

  takeDamage(damage: number) {
    this.health = Math.max(0, this.health - damage);
    if (this.health === 0) {
      this.throttle = 0;
      this.thrustingDown = false;
      this.thrustingUp = false;
      this.targetRotation = null;
      this.rotatingLeft = false;
      this.rotatingRight = false;
      this.joystickTarget = undefined;
    }
  }

  isAlive() {
    return this.health > 0;
  }

  preStep(dt: number, timestep: number) {
    super.preStep(dt, timestep);

    this.body.resetForces(false);
    if (this.fuel === 0) {
      this.throttle = 0;
    } else {
      // Set target rotation
      const rotation = this.rotation;
      if (this.rotatingLeft || this.rotatingRight) {
        let target = this.rotation + TURN_RATE * dt * (this.rotatingLeft ? 1 : -1);
        if (rotation < 0 && target > 0 || rotation > 0 && target < 0) {
          target = 0;
        }
        this.targetRotation = normalizeAngle(target);
      } else if (this.joystickTarget) {
        this.targetRotation = this.joystickTarget.rotation;
      } else {
        this.targetRotation = null;
      }
  
      if (this.thrustingUp || this.thrustingDown) {
        let target = this.throttle + THROTTLE_RATE * dt * (this.thrustingUp ? 1 : -1);
        target = Math.max(0, Math.min(1.0, target));
        this.throttle = target;
      } else if (this.joystickTarget) {
        this.throttle = this.joystickTarget.throttle;
      }
  
      if (this.throttle !== 0) {
        const force = new Vector2(0, FULL_THROTTLE_FORCE);
        const rotatedForce = rotateVector(force, rotation);
        this.body.addForce(rotatedForce, true);
        this.fuel = Math.max(0, this.fuel - THROTTLE_FUEL_BURN_RATE * this.throttle * dt);
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
        this.fuel = Math.max(0, this.fuel - ROTATE_FUEL_BURN_RATE * dt);
      }
    }

    // Replenish weapons
    for (const rocketType of ["small", "big"] as const) {
      const rocketState = this.rocketState[rocketType];
      if (rocketState.count < ROCKET_STATS[rocketType].ammo && (timestep - rocketState.replenishFromTimestep) > ROCKET_STATS[rocketType].replenishSteps) {
        rocketState.count += 1;
        rocketState.replenishFromTimestep = timestep;
      }
    }
  }
}