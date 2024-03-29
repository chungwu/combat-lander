import { PlayerSettings } from "./components/dialogs";
import { LanderColor, RocketType } from "./game/constants";
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
  | { type: "joined", playerId: string, name: string, color: LanderColor, startX: number, startY: number}

export interface JoinMessage extends Message {
  type: "join";
  name: string;
  color: LanderColor;
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
  playerSettings: PlayerSettings;
  options: GameOptions;
}

export interface CancelResetGameMessage extends Message {
  type: "cancel-reset";
}

export interface PlayerInfoMessage extends Message {
  type: "player-info";
  name: string;
  color: LanderColor;
}

export interface ChatMessage extends Message {
  type: "chat";
  playerId: string;
  message: string;
}

export type ClientMessage = 
  | JoinMessage 
  | PlayerInputMessage 
  | RequestResetGameMessage 
  | CancelResetGameMessage 
  | RequestStartGameMessage 
  | PlayerInfoMessage 
  | ChatMessage;

export interface InitMessage extends Message {
  type: "init";
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
  | MetaSyncMessage
  | PartialSyncMessage
  | ResetGameMessage
  | PlayerInputMessage
  | ResetPendingMessage
  | ResetCancelledMessage
  | ChatMessage;

export type FullSerializedGameState = ReturnType<typeof LanderGameState.prototype.serializeFull>;