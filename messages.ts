import { RocketType } from "./game/constants";
import type { LanderGameState } from "./game/game-state";

interface Message {
  time: number;
  gameId: string;
}

export type GameInputEvent = 
  | { type: "thrust", dir: "up" | "down", active: boolean }
  | { type: "rotate", dir: "left" | "right", active: boolean }
  | { type: "joystick", targetThrottle: number, targetRotation: number | null, rotatingLeft: boolean | null, rotatingRight: boolean | null }
  | { type: "fire-rocket", rocketType: RocketType }

export interface JoinMessage extends Message {
  type: "join";
  name: string;
}

export interface PlayerInputMessage extends Message {
  type: "input";
  playerId: string;
  event: GameInputEvent;
}

export interface RequestResetGameMessage extends Message {
  type: "request-reset";
}

export interface CancelResetGameMessage extends Message {
  type: "cancel-reset";
}

export type ClientMessage = JoinMessage | PlayerInputMessage | RequestResetGameMessage | CancelResetGameMessage;

export interface InitMessage extends Message {
  type: "init";
  payload: FullSerializedGameState;
}

export interface FullSyncMessage extends Message {
  type: "full";
  payload: FullSerializedGameState;
}

export interface PartialSyncMessage extends Message {
  type: "partial";
  payload: ReturnType<typeof LanderGameState.prototype.serializePartial>;
}

export interface MetaSyncMessage extends Message {
  type: "meta";
  payload: ReturnType<typeof LanderGameState.prototype.serializeMeta>;
}

export interface ResetGameMessage extends Message {
  type: "reset";
  paylod: FullSerializedGameState;
}

export type ServerMessage = 
  | InitMessage
  | FullSyncMessage
  | MetaSyncMessage
  | PartialSyncMessage
  | ResetGameMessage
  | PlayerInputMessage;

export type FullSerializedGameState = ReturnType<typeof LanderGameState.prototype.serializeFull>;