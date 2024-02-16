import { clamp, pull } from "lodash";
import { ClientLanderEngine } from "./client-engine";
import { JOYSTICK_CONFIG } from "./constants";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { normalizeAngle, vectorMagnitude } from "@/utils/math";
import { Vector2 } from "@dimforge/rapier2d";
import { GameInputEvent } from "@/messages";
import assert from "assert";
import { ExtractByType } from "@/utils/utils";

export interface PseudoKeyboardEvent {
  type: "keyup" | "keydown" | "keypress";
  key: string;
}

export type KeyEventListener = (event: PseudoKeyboardEvent) => void;

export class KeyboardController {
  private pressingUp = false;
  private pressingDown = false;
  private pressingLeft = false;
  private pressingRight = false;
  private lastJoystickMsg: ExtractByType<GameInputEvent, "joystick"> | undefined = undefined;
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
      this.lastJoystickMsg = undefined;
    }
  }

  private handleKeyUp(event: PseudoKeyboardEvent) {
    const lander = this.selfLander;
    if (!lander) {
      return;
    }
    const arrowKey = this.deriveArrowKeyDirection(event.key);
    if (arrowKey && lander.isAlive()) {
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
      this.lastJoystickMsg = undefined;
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

  handleJoystickMove(event: { x: number | null, y: number | null }) {
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
        return Math.round(magnitude * 100) / 100;
      };

      if (JOYSTICK_CONFIG.scheme === "mixed") {
        const normY = normed(event.y!);
        const normX = normed(event.x!);
        if (normX == null && normY == null) {
          return;
        }
        const targetThrottle = normY == null ? lander.throttle : normY < 0 ? 0 : normY;
        this.maybeProcessJoystickEvent({
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
        this.maybeProcessJoystickEvent({
          type: "joystick",
          targetThrottle, targetRotation, rotatingLeft: null, rotatingRight: null
        });
      } else if (JOYSTICK_CONFIG.scheme === "duo") {
        if (event.x != null) {
          const normX = normed(event.x, 0.2);
          this.maybeProcessJoystickEvent({
            type: "joystick",
            targetThrottle: lander.throttle,
            targetRotation: null,
            ...this.lastJoystickMsg,
            rotatingLeft: normX != null && normX < 0,
            rotatingRight: normX != null && normX > 0,
          });
        } else if (event.y != null) {
          const normY = normed(event.y);
          const targetThrottle = normY == null ? lander.throttle : normY < 0 ? 0 : normY;
          this.maybeProcessJoystickEvent({
            type: "joystick",
            targetRotation: null,
            rotatingLeft: false,
            rotatingRight: false,
            ...this.lastJoystickMsg,
            targetThrottle
          });
        }
      }
    }
  }

  private maybeProcessJoystickEvent(event: ExtractByType<GameInputEvent, "joystick">) {
    // Sends joystick event to engine if it differs from the last event
    // we sent, to avoid flooding the server with events
    if (
      !this.lastJoystickMsg ||
      this.lastJoystickMsg.rotatingLeft != event.rotatingLeft ||
      this.lastJoystickMsg.rotatingRight != event.rotatingRight ||
      this.lastJoystickMsg.targetRotation != event.targetRotation ||
      this.lastJoystickMsg.targetThrottle != event.targetThrottle
    ) {
      this.lastJoystickMsg = event;
      this.engine.processLocalInput(event);
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
      this.maybeProcessJoystickEvent({
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
      this.maybeProcessJoystickEvent({
        type: "joystick",
        targetThrottle: 0,
        rotatingLeft: false,
        rotatingRight: false,
        targetRotation: null
      });
    } else if (JOYSTICK_CONFIG.scheme === "duo") {
      this.maybeProcessJoystickEvent({
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
    }
  }
}
