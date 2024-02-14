import { pull } from "lodash";
import { ClientLanderEngine } from "./client-engine";

export interface PseudoKeyboardEvent {
  type: "keyup" | "keydown" | "keypress";
  key: string;
}

export type KeyEventListener = (event: PseudoKeyboardEvent) => void;

export class KeyboardController {
  pressingUp = false;
  pressingDown = false;
  pressingLeft = false;
  pressingRight = false;
  private listeners: KeyEventListener[] = [];
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

  handleKeyEvent(event: PseudoKeyboardEvent) {
    if (event.type === "keyup") {
      this.handleKeyUp(event);
    } else if (event.type === "keydown") {
      this.handleKeyDown(event);
    } else if (event.type === "keypress") {
      this.handleKeyPress(event);
    }
  }

  handleJoystick(x: number, y: number) {
    this.engine.processLocalInput({
      type: "joystick", x, y
    });
  }

  addListener(listener: KeyEventListener) {
    this.listeners.push(listener);
  }

  removeListener(listener: KeyEventListener) {
    pull(this.listeners, listener);
  }

  private fireEvent(event: KeyboardEvent) {
    this.listeners.forEach(listener => listener(event as PseudoKeyboardEvent));
  }

  private get selfLander() {
    return this.engine.selfLander;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    this.handleKeyDown(event as PseudoKeyboardEvent);
    this.fireEvent(event);
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.handleKeyUp(event as PseudoKeyboardEvent);
    this.fireEvent(event);
  }

  private onKeyPress = (event: KeyboardEvent) => {
    this.handleKeyPress(event as PseudoKeyboardEvent);
    this.fireEvent(event);
  }

  private handleKeyDown(event: PseudoKeyboardEvent) {
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
  }

  private handleKeyUp(event: PseudoKeyboardEvent) {
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
  }

  private handleKeyPress(event: PseudoKeyboardEvent) {
    if (!this.selfLander) {
      return;
    }

    if (this.selfLander.isAlive()) {
      if (event.key === "q") {
        this.engine.processLocalInput({
          type: "fire-rocket", rocketType: "small"
        });
      } else if (event.key === "w") {
        this.engine.processLocalInput({
          type: "fire-rocket", rocketType: "big"
        });
      }
    }
  }

  private deriveArrowKeyDirection(key: string) {
    if (key.startsWith("Arrow")) {
      return key.replace("Arrow", "").toLowerCase() as "up" | "down" | "right" | "left";
    }
    return undefined;
  }
}
