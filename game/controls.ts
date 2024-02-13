import { ClientLanderEngine } from "./client-engine";

export class KeyboardController {
  private pressingUp = false;
  private pressingDown = false;
  private pressingLeft = false;
  private pressingRight = false;
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
    if (arrowKey && lander.isAlive()) {
      console.log("KEY DOWN", arrowKey);
      if (arrowKey === "up" && !this.pressingDown) {
        this.pressingDown = true;
        this.engine.processLocalInput({
          type: "thrust", dir: "up", active: true
        });
      } else if (arrowKey === "down" && !this.pressingUp) {
        this.pressingUp = true;
        this.engine.processLocalInput({
          type: "thrust", dir: "down", active: true
        });
      } else if (arrowKey === "left" && !this.pressingLeft) {
        this.pressingLeft = true;
        this.engine.processLocalInput({
          type: "rotate", dir: "left", active: true
        });
      } else if (arrowKey === "right" && !this.pressingRight) {
        this.pressingRight = true;
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
    if (arrowKey && lander.isAlive()) {
      console.log("KEY UP", arrowKey);
      if (arrowKey === "up" && this.pressingDown) {
        this.pressingDown = false;
        this.engine.processLocalInput({
          type: "thrust", dir: "up", active: false
        });
      } else if (arrowKey === "down" && this.pressingUp) {
        this.pressingUp = false;
        this.engine.processLocalInput({
          type: "thrust", dir: "down", active: false
        });
      } else if (arrowKey === "left" && this.pressingLeft) {
        this.pressingLeft = false;
        this.engine.processLocalInput({
          type: "rotate", dir: "left", active: false
        });
      } else if (arrowKey === "right" && this.pressingRight) {
        this.pressingRight = false;
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

    if (event.key === "q" && this.selfLander.isAlive()) {
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