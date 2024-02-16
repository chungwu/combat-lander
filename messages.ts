import { RocketType } from "./game/constants";
import type { GameOptions, LanderGameState } from "./game/game-state";

interface Message {
  time: number;
  gameId: string;
}

export type GameInputEvent = 
  | { type: "thrust", dir: "up" | "down", active: boolean }
  | { type: "rotate", dir: "left" | "right", active: boolean }
  | { type: "joystick", targetThrottle: number, targetRotation: number | null, rotatingLeft: boolean | null, rotatingRight: boolean | null }
  | { type: "fire-rocket", rocketType: RocketType, id: string }

export interface JoinMessage extends Message {
  type: "join";
  name: string;
}

export interface PlayerInputMessage extends Message {
  type: "input";
  playerId: string;
  event: GameInputEvent;
}

export interface ResetOptions {
  preserveScores: boolean;
  preserveMap: boolean;
}
export interface RequestResetGameMessage extends Message {
  type: "request-reset";
  options: GameOptions;
  resetOptions: ResetOptions;
}
export interface RequestStartGameMessage extends Message {
  type: "request-start";
  options: GameOptions;
  name: string;
}

export interface CancelResetGameMessage extends Message {
  type: "cancel-reset";
}

export interface RequestFullSyncMessage extends Message {
  type: "request-full";
}

export type ClientMessage = JoinMessage | PlayerInputMessage | RequestResetGameMessage | CancelResetGameMessage | RequestStartGameMessage | RequestFullSyncMessage;

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
  lastPlayerInputTimesteps: Record<string, number[]>;
}

export interface MetaSyncMessage extends Message {
  type: "meta";
  payload: ReturnType<typeof LanderGameState.prototype.serializeMeta>;
}

export interface ResetPendingMessage extends Message {
  type: "reset-pending";
  resetTimestamp: number;
  cause: "dead" | "won" | "requested";
}

export interface ResetCancelledMessage extends Message {
  type: "reset-cancelled";
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
  | PlayerInputMessage
  | ResetPendingMessage
  | ResetCancelledMessage;

export type FullSerializedGameState = ReturnType<typeof LanderGameState.prototype.serializeFull>;