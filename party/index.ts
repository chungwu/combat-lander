import { PACKR } from "@/game/packr";
import { ServerLanderEngine } from "@/game/server-engine";
import { ClientMessage } from "@/messages";
import { ensure } from "@/utils/utils";
import type * as Party from "partykit/server";
import { loadRapierWasm } from "./rapier-wasm";

await loadRapierWasm();

export default class Server implements Party.Server {
  private _engine: ServerLanderEngine | undefined;
  constructor(readonly room: Party.Room) {
  }

  async onStart() {
  }

  private async ensureInitialized() {
    if (!this._engine) {
      console.log(`Initializing engine... ${this.room.id}`);
      this._engine = new ServerLanderEngine(this.room);
    }
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

    if (!this._engine) {
      await this.ensureInitialized();
    }

    this.engine.onConnect(conn);
  }

  onMessage(message: string | Uint8Array | Buffer, sender: Party.Connection) {
    const msg = this.unpackMessage(message);
    this.engine.handleMessage(sender, msg);
  }

  onClose(conn: Party.Connection) {
    const connsLeft = Array.from(this.room.getConnections()).length;
    console.log(`Closed: ${conn.id}; now ${connsLeft} connections left`);
    this.engine.onDisconnect(conn);

    if (connsLeft === 0) {
      this.engine.dispose();
      this._engine = undefined;
    }
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
