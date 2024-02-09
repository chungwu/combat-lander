import { Vector2, World } from "@dimforge/rapier2d";
import { Ground } from "./objects/ground";
import { Lander } from "./objects/lander";
import { Moon, generateRandomMap } from "./map";

export class LanderGameState {
  public landers: Lander[];
  public ground: Ground;

  static createNew() {
    const moon = generateRandomMap();
    const world = new World(new Vector2(0, moon.gravity));
    return new LanderGameState(moon, world);
  }

  static createFromFull(opts: ReturnType<typeof LanderGameState.prototype.serializeFull>) {
    const state = new LanderGameState(opts.moon, opts.world);
    for (const lander of opts.landers) {
      state.landers.push(Lander.createFrom(opts.world, lander));
    }
    state.ground.mergeFrom(opts.world, opts.ground);
    return state;
  }

  private constructor(
    public moon: Moon,
    public world: World,
  ) {
    this.ground = Ground.create(this);
    this.landers = [];
  }

  serializeFull() {
    return {
      moon: this.moon,
      world: this.world,
      ground: this.ground.serialize(),
      landers: this.landers.map(l => l.serialize())
    };
  }

  serializePartial() {
    return {
      world: this.world,
      landers: this.landers.map(l => l.serialize())
    };
  }

  mergeFull(payload: ReturnType<typeof this.serializeFull>) {
    this.moon = payload.moon;
    this.world = payload.world;

    this.ground.mergeFrom(this.world, payload.ground);

    for (const fromLander of payload.landers) {
      let curLander = this.landers.find(l => l.id === fromLander.id);
      if (!curLander) {
        curLander = Lander.createFrom(this.world, fromLander);
        this.landers.push(curLander);
      } else {
        curLander.mergeFrom(this.world, fromLander);
      }
    }
  }

  mergePartial(payload: ReturnType<typeof this.serializePartial>) {
    this.world = payload.world;
    this.ground.updateCollider(this.world);
    for (const fromLander of payload.landers) {
      let lander = this.landers.find(l => l.id === fromLander.id);
      lander?.mergeFrom(this.world, fromLander);
    }
  }
}