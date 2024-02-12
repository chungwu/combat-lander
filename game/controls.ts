import { ClientLanderEngine } from "./client-engine";

export class KeyboardController {
  constructor(private engine: ClientLanderEngine) {

  }

  install() {
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keypress", this.onKeyPress);
  }
  
  uninstall() {
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keypress", this.onKeyPress);
  }

  private get selfLander() {
    return this.engine.selfLander;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const lander = this.selfLander;
    if (!lander) {
      return;
    }

    const arrowKey = this.deriveArrowKeyDirection(event.key);
    if (arrowKey) {
      if (arrowKey === "up" && !lander.thrustingUp && lander.throttle < 1) {
        this.engine.processLocalInput({
          type: "thrust", dir: "up", active: true
        });
      } else if (arrowKey === "down" && !lander.thrustingDown && lander.throttle > 0) {
        this.engine.processLocalInput({
          type: "thrust", dir: "down", active: true
        });
      } else if (arrowKey === "left" && !lander.rotatingLeft) {
        this.engine.processLocalInput({
          type: "rotate", dir: "left", active: true
        });
      } else if (arrowKey === "right" && !lander.rotatingRight) {
        this.engine.processLocalInput({
          type: "rotate", dir: "right", active: true
        });
      }
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    const lander = this.selfLander;
    if (!lander) {
      return;
    }
    const arrowKey = this.deriveArrowKeyDirection(event.key);
    if (arrowKey) {
      if (arrowKey === "up" && lander.thrustingUp) {
        this.engine.processLocalInput({
          type: "thrust", dir: "up", active: false
        });
      } else if (arrowKey === "down" && lander.thrustingDown) {
        this.engine.processLocalInput({
          type: "thrust", dir: "down", active: false
        });
      } else if (arrowKey === "left" && lander.rotatingLeft) {
        this.engine.processLocalInput({
          type: "rotate", dir: "left", active: false
        });
      } else if (arrowKey === "right" && lander.rotatingRight) {
        this.engine.processLocalInput({
          type: "rotate", dir: "right", active: false
        });
      }
    }
  };

  private onKeyPress = (event: KeyboardEvent) => {
    if (!this.selfLander) {
      return;
    }

    if (event.key === "q") {
      this.engine.processLocalInput({
        type: "fire-rocket", rocketType: "small"
      });
    }
  };

  private deriveArrowKeyDirection(key: string) {
    if (key.startsWith("Arrow")) {
      return key.replace("Arrow", "").toLowerCase() as "up" | "down" | "right" | "left";
    }
    return undefined;
  }
}

export function generateGameInputEvent(engine: ClientLanderEngine, event: KeyboardEvent) {
  if (event.type === "keyup") {

  } else if (event.type === "keydown") {

  }
}