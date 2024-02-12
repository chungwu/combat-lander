import { LanderGameState } from "@/game/game-state";
import { PACKR } from "@/game/packr";
import { ensure } from "@/utils/utils";
import { remove } from "lodash";
import type * as Party from "partykit/server";
import { loadRapierWasm } from "./rapier-wasm";
import { ClientMessage } from "@/messages";
import { ServerLanderEngine } from "@/game/server-engine";

export default class Server implements Party.Server {
  private _engine: ServerLanderEngine | undefined;
  constructor(readonly room: Party.Room) {
  }

  async onStart() {
    await loadRapierWasm();
    this._engine = new ServerLanderEngine(this.room);
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
    this.engine.onConnect(conn);
  }

  onMessage(message: string | Uint8Array | Buffer, sender: Party.Connection) {
    const msg = this.unpackMessage(message);
    this.engine.handleMessage(sender, msg);
  }

  onClose(conn: Party.Connection) {
    console.log("CLOSED", conn.id);
    this.engine.onDisconnect(conn);
  }

  private unpackMessage(message: string | Uint8Array | Buffer): ClientMessage {
    if (typeof message === "string") {
      return JSON.parse(message);
    } else {
      return PACKR.unpack(message);
    }
  }
}

Server satisfies Party.Worker;
