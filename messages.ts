
export type InputEvent = 
  | { type: "keyup", key: "up"|"down"|"left"|"right"}
  | { type: "keydown", key: "up"|"down"|"left"|"right"}

export interface JoinMessage {
  type: "join";
  name: string;
}
export interface InputMessage {
  type: "input";
  event: InputEvent;
}

export type ClientMessage = JoinMessage | InputMessage;
