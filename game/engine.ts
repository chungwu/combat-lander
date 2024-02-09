import { Vector2 } from "@dimforge/rapier2d";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import PartySocket from "partysocket";
import { InputEvent } from "@/messages";

class BaseLanderEngine {
  protected timestep = 0;
  constructor(
    protected state: LanderGameState,
  ) {}

  step() {
    const world = this.state.world;
    for (const lander of this.state.landers) {
      lander.preStep(world.timestep);
    }
    this.state.world.step();
    for (const lander of this.state.landers) {
      lander.postStep(world.timestep);
      lander.wrapTranslation(this.state.moon.worldWidth);
    }
    this.timestep += 1;
  }

  processPlayerInput(playerId: string, event: InputEvent) {
    const lander = this.state.landers.find(l => l.id === playerId);
    if (lander) {
      lander.processInput(event);
    }
  }
}

export class ClientLanderEngine extends BaseLanderEngine {
  constructor(
    state: LanderGameState,
    private socket: PartySocket
  ) {
    super(state);
  }

  processInput(event: InputEvent) {
    const lander = this.state.landers.find(l => l.id === this.socket.id);
    if (lander) {
      lander.processInput(event);
      this.socket.send(JSON.stringify({
        type: "input",
        event
      }));
    }
  }

  private isPlaying() {
    const lander = this.state.landers.find(l => l.id === this.socket.id);
    return !!lander;
  }
}

export class ServerLanderEngine extends BaseLanderEngine {
  constructor(state: LanderGameState) {
    super(state);
  }

  addPlayer(opts: { id: string, name: string }) {
    const lander = Lander.create(this.state, { 
      ...opts,
      startingLocation: new Vector2(
        Math.random() * this.state.moon.worldWidth, 
        this.state.moon.worldHeight * 0.5
      )
    });
    this.state.landers.push(lander);
  }
}