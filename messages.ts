import type { LanderGameState } from "./game/game-state";
import type { RocketType } from "./game/rocket";

export type GameInputEvent = 
  | { type: "keyup", key: "up"|"down"|"left"|"right"}
  | { type: "keydown", key: "up"|"down"|"left"|"right"}
  | { type: "fire-rocket", rocketType: RocketType }

export interface JoinMessage {
  type: "join";
  name: string;
  time: number;
}

export interface PlayerInputMessage {
  type: "input";
  playerId: string;
  event: GameInputEvent;
  time: number;
}

export type ClientMessage = JoinMessage | PlayerInputMessage;

export interface InitMessage {
  type: "init";
  time: number;
  payload: FullSerializedGameState;
}

export interface FullSyncMessage {
  type: "full";
  time: number;
  payload: FullSerializedGameState;
}

export interface PartialSyncMessage {
  type: "partial";
  time: number;
  payload: ReturnType<typeof LanderGameState.prototype.serializePartial>;
}

export type ServerMessage = 
  | InitMessage
  | FullSyncMessage
  | PartialSyncMessage
  | PlayerInputMessage;

export type FullSerializedGameState = ReturnType<typeof LanderGameState.prototype.serializeFull>;