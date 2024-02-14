import { clamp, pull } from "lodash";
import { ClientLanderEngine } from "./client-engine";
import { JOYSTICK_CONFIG } from "./constants";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { normalizeAngle, vectorMagnitude } from "@/utils/math";
import { Vector2 } from "@dimforge/rapier2d";

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
  private joystickActive = false;
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

  handleJoystickMove(event: IJoystickUpdateEvent) {
    const lander = this.engine.selfLander;
    if (!lander) {
      return;
    }

    if (JOYSTICK_CONFIG.scheme === "keyboard") {
      if (event.x != null) {
        if (event.x < -JOYSTICK_CONFIG.threshold) {
          this.handleKeyEvent({type: "keydown", key: "ArrowLeft"});
          this.handleKeyEvent({type: "keyup", key: "ArrowRight"});
        } else if (event.x > JOYSTICK_CONFIG.threshold) {
          this.handleKeyEvent({type: "keydown", key: "ArrowRight"});
          this.handleKeyEvent({type: "keyup", key: "ArrowLeft"});
        } else {
          if (this.pressingLeft) {
            this.handleKeyEvent({type: "keyup", key: "ArrowLeft"});
          } 
          if (this.pressingRight) {
            this.handleKeyEvent({type: "keyup", key: "ArrowRight"});
          }
        }
      }
      if (event.y != null) {
        if (event.y < -JOYSTICK_CONFIG.threshold) {
          this.handleKeyEvent({type: "keydown", key: "ArrowDown"});
          this.handleKeyEvent({type: "keyup", key: "ArrowUp"});
        } else if (event.y > JOYSTICK_CONFIG.threshold) {
          this.handleKeyEvent({type: "keydown", key: "ArrowUp"});
          this.handleKeyEvent({type: "keyup", key: "ArrowDown"});
        } else {
          if (this.pressingUp) {
            this.handleKeyEvent({type: "keyup", key: "ArrowUp"});
          }
          if (this.pressingDown) {
            this.handleKeyEvent({type: "keyup", key: "ArrowDown"});
          }
        }
      }
    } else {
      const normed = (val: number, actionThreshold: number=JOYSTICK_CONFIG.threshold) => {
        if (Math.abs(val) < actionThreshold) {
          return undefined;
        }
        let magnitude = (Math.abs(val) - actionThreshold) / (1 - actionThreshold);
        magnitude = magnitude * (val > 0 ? 1 : -1);
        return Math.round(magnitude * 10000) / 10000;
      };
      if (JOYSTICK_CONFIG.scheme === "mixed") {
        const normY = normed(event.y!);
        const normX = normed(event.x!);
        if (normX == null && normY == null) {
          return;
        }
        const targetThrottle = normY == null ? lander.throttle : normY < 0 ? 0 : normY;
        this.engine.processLocalInput({
          type: "joystick", 
          targetThrottle,
          targetRotation: null,
          rotatingLeft: normX != null && normX < 0,
          rotatingRight: normX != null && normX > 0
        });
        // return { x: event.x, y: event.y! };
      } else if (JOYSTICK_CONFIG.scheme === "angled") {
        const normY = normed(event.y!);
        const normX = normed(event.x!, 0.01);
        if (normX == null && normY == null) {
          return;
        }
        let targetRotation = normalizeAngle(Math.atan2(normY ?? 0, normX ?? 0) - 0.5*Math.PI);
        if (targetRotation) {
          targetRotation = clamp(targetRotation, -0.5 * Math.PI, 0.5 * Math.PI);
        }
        const targetThrottle = (normY ?? 0) <= 0 ? 0 : vectorMagnitude(new Vector2(normX ?? 0, normY ?? 0));
        this.engine.processLocalInput({
          type: "joystick",
          targetThrottle, targetRotation, rotatingLeft: null, rotatingRight: null
        });
      }
    }
  }

  handleJoystickStop() {
    const lander = this.engine.selfLander;
    if (!lander) {
      return;
    }

    if (JOYSTICK_CONFIG.scheme === "keyboard") {
      if (this.pressingUp) {
        this.handleKeyEvent({type: "keyup", key: "ArrowUp"});
      }
      if (this.pressingDown) {
        this.handleKeyEvent({type: "keyup", key: "ArrowDown"});
      }
      if (this.pressingLeft) {
        this.handleKeyEvent({type: "keyup", key: "ArrowLeft"});
      }
      if (this.pressingRight) {
        this.handleKeyEvent({type: "keyup", key: "ArrowRight"});
      }
    } else if (JOYSTICK_CONFIG.scheme === "mixed") {
      this.engine.processLocalInput({
        type: "joystick",
        targetThrottle: lander.throttle,
        rotatingLeft: false,
        rotatingRight: false,
        targetRotation: null
      });
      return {
        x: 0,
        y: lander.throttle === 0 ? 0 : lander.throttle * (1 - JOYSTICK_CONFIG.threshold) + JOYSTICK_CONFIG.threshold
      }
    } else if (JOYSTICK_CONFIG.scheme === "angled") {
      this.engine.processLocalInput({
        type: "joystick",
        targetThrottle: 0,
        rotatingLeft: false,
        rotatingRight: false,
        targetRotation: null
      });
    }
  }
}
