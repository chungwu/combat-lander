import { PACKR } from "@/game/packr";
import { ServerLanderEngine } from "@/game/server-engine";
import { ClientMessage } from "@/messages";
import { ensure } from "@/utils/utils";
import { routePartykitRequest, Server } from "partyserver";
import type { Connection, ConnectionContext } from "partyserver";
import { loadRapierWasm } from "./rapier-wasm";

await loadRapierWasm();

type Env = {
  Main: DurableObjectNamespace<CombatLander>;
};

export class CombatLander extends Server<Env> {
  // The live physics simulation needs its in-memory state and 60 Hz timer.
  static options = { hibernate: false };

  private _engine: ServerLanderEngine | undefined;

  private async ensureInitialized() {
    if (!this._engine) {
      console.log(`Initializing engine... ${this.name}`);
      this._engine = new ServerLanderEngine(this);
    }
  }

  get engine() {
    return ensure(this._engine);
  }

  async onConnect(conn: Connection, ctx: ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.name}
  url: ${new URL(ctx.request.url).pathname}`
    );

    if (!this._engine) {
      await this.ensureInitialized();
    }

    this.engine.onConnect(conn);
  }

  async onMessage(sender: Connection, message: string | ArrayBuffer) {
    const msg = this.unpackMessage(message);
    this.engine.handleMessage(sender, msg);
  }

  onClose(conn: Connection) {
    const connsLeft = Array.from(this.getConnections()).length;
    console.log(`Closed: ${conn.id}; now ${connsLeft} connections left`);
    this._engine?.onDisconnect(conn);

    if (connsLeft === 0) {
      this._engine?.dispose();
      this._engine = undefined;
    }
  }

  private unpackMessage(message: string | ArrayBuffer): ClientMessage {
    if (typeof message === "string") {
      return JSON.parse(message);
    } else {
      return PACKR.unpack(new Uint8Array(message));
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", server: "combat-lander" });
    }
    // partysocket 0.0.25 uses this route when no party is specified.
    if (url.pathname.startsWith("/party/")) {
      url.pathname = url.pathname.replace("/party/", "/parties/main/");
      request = new Request(url, request);
    }
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
