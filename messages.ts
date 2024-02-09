import type { LanderGameState } from "./game/game-state";

export type InputEvent = 
  | { type: "keyup", key: "up"|"down"|"left"|"right"}
  | { type: "keydown", key: "up"|"down"|"left"|"right"}

export interface JoinMessage {
  type: "join";
  name: string;
  time: number;
}

export interface PlayerInputMessage {
  type: "input";
  playerId: string;
  event: InputEvent;
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