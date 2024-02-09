import { ServerLanderEngine } from "@/game/engine";
import { LanderGameState } from "@/game/game-state";
import { PACKR } from "@/game/packr";
import { ensure } from "@/utils/utils";
import { remove } from "lodash";
import type * as Party from "partykit/server";
import { loadRapierWasm } from "./rapier-wasm";
import { ClientMessage } from "@/messages";

export default class Server implements Party.Server {
  private _game: LanderGameState | undefined;
  private _engine: ServerLanderEngine | undefined;
  private intervalId: any | undefined;
  private viewers: string[] = [];
  private timestep: number = 0;
  constructor(readonly room: Party.Room) {
  }

  async onStart() {
    await loadRapierWasm();
    this._game = LanderGameState.createNew();
    this._engine = new ServerLanderEngine(this.game);
  }

  get game() {
    return ensure(this._game);
  }

  get engine() {
    return ensure(this._engine);
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`
    );
    this.viewers.push(conn.id);
    // let's send a message to the connection
    conn.send(PACKR.pack({
      type: "init",
      payload: this.game.serializeFull()
    }));
    this.maybeStart();
  }

  onMessage(message: string | Uint8Array | Buffer, sender: Party.Connection) {
    const msg = this.unpackMessage(message);
    if (msg.type === "join") {
      this.engine.addPlayer({
        id: sender.id,
        name: msg.name
      });
      this.room.broadcast(this.makeFullMessage());
    } else if (msg.type === "input") {
      this.engine.processPlayerInput(sender.id, msg.event);
    }
  }

  onClose(conn: Party.Connection) {
    console.log("CLOSED", conn.id);
    remove(this.viewers, x => x === conn.id);
    this.maybeStop();
  }

  private unpackMessage(message: string | Uint8Array | Buffer): ClientMessage {
    if (typeof message === "string") {
      return JSON.parse(message);
    } else {
      return PACKR.unpack(message);
    }
  }

  private maybeStart() {
    if (this.intervalId == null && this.viewers.length > 0) {
      this.intervalId = setInterval(() => {
        this.step();
      }, 1000 / 60);
    }
  }

  private maybeStop() {
    if (this.intervalId != null && this.viewers.length === 0) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private step() {
    this.engine.step();
    this.timestep += 1;
    if (this.timestep % 10 === 0) {
      this.room.broadcast(PACKR.pack({
        type: "partial",
        payload: this.game.serializePartial()
      }))
    }
  }

  private makeFullMessage() {
    return PACKR.pack({
      type: "full",
      payload: this.game.serializeFull()
    });
  }
}

Server satisfies Party.Worker;
