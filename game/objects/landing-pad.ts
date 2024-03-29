import { Collider, ColliderDesc, RigidBodyDesc, World } from "@dimforge/rapier2d";
import { LANDING_PAD_STATS, LandingPadType } from "../constants";
import { GameObject } from "./game-object";
import { Moon } from "../map";
import { nanoid } from "nanoid";

interface LandingPadOpts {
  type: LandingPadType;
}

export class LandingPad extends GameObject {
  public type: LandingPadType;

  static create(world: World, moon: Moon, padIndex: number) {
    const pad = moon.landingPads[padIndex];
    const vertex = moon.vertices[pad.index];
    const body = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(vertex[0], vertex[1]));
    const width = LANDING_PAD_STATS[pad.type].width;
    const colliderDesc = ColliderDesc.polyline(new Float32Array([0, 0, width, 0])).setSensor(true);
    const collider = world.createCollider(
      colliderDesc,
      body
    );
    return new LandingPad(nanoid(), collider, {type: pad.type});
  }

  static createFrom(world: World, moon: Moon, padIndex: number, payload: ReturnType<typeof LandingPad.prototype.serialize>) {
    const pad = moon.landingPads[padIndex];
    const collider = world.getCollider(payload.handle);
    return new LandingPad(payload.id, collider, { type: pad.type });
  }

  constructor(id: string, collider: Collider, opts: LandingPadOpts) {
    super(id, collider);
    this.type = opts.type;
  }

  serialize() {
    return {
      id: this.id,
      handle: this.handle,
    };
  }

  mergeFrom(world: World, opts: ReturnType<typeof this.serialize>) {
    this.updateCollider(world, opts.handle);
  }
}