import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { addExtension, Packr } from "msgpackr";
import PartySocket from "partysocket";

// Inspect the real wire format without initializing Rapier in Node.
addExtension({ type: 11, unpack: (snapshot) => snapshot });
addExtension({ type: 12, read: (moon) => moon });
const packr = new Packr();
const origin = new URL(process.env.SERVER_URL ?? "http://127.0.0.1:1999");
assert(["http:", "https:"].includes(origin.protocol));
const room = `migration-test-${randomUUID()}`;
const clients = [];

function connect(roomId, id, party) {
  const socket = new PartySocket({
    host: origin.host,
    protocol: origin.protocol === "https:" ? "wss" : "ws",
    room: roomId,
    id,
    party,
    WebSocket,
    maxRetries: 0,
  });
  socket.binaryType = "arraybuffer";
  const messages = [];
  const waiters = new Set();
  let error;
  socket.addEventListener("message", (event) => {
    try {
      messages.push(packr.unpack(new Uint8Array(event.data)));
    } catch (cause) {
      error = cause;
    }
    for (const notify of waiters) notify();
  });
  socket.addEventListener("error", () => {
    error = new Error(`WebSocket failed for ${roomId}`);
    for (const notify of waiters) notify();
  });
  const client = {
    socket,
    waitFor(predicate, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error("Timed out waiting for multiplayer message")), timeout);
        function finish(cause, message) {
          clearTimeout(timer);
          waiters.delete(check);
          if (cause) reject(cause);
          else resolve(message);
        }
        function check() {
          if (error) return finish(error);
          const index = messages.findIndex(predicate);
          if (index !== -1) finish(null, messages.splice(index, 1)[0]);
        }
        waiters.add(check);
        check();
      });
    },
    async close() {
      if (socket.readyState === WebSocket.CLOSED) return;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WebSocket did not close")), 5000);
        socket.addEventListener("close", () => { clearTimeout(timer); resolve(); }, { once: true });
        socket.close();
      });
    },
  };
  clients.push(client);
  return client;
}

try {
  const health = await fetch(new URL("/health", origin));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");

  // Test both the existing client's /party route and PartyServer's /parties route.
  const first = connect(room, "migration-player-a");
  const init = await first.waitFor((m) => m.type === "init");
  assert(init.payload.world instanceof Uint8Array);
  assert(init.payload.world.byteLength > 0);
  const second = connect(room, "migration-player-b", "main");
  const secondInit = await second.waitFor((m) => m.type === "init");
  assert.equal(secondInit.payload.id, init.payload.id);

  first.socket.send(JSON.stringify({ type: "join", gameId: init.payload.id, time: init.time, name: "Migration A", color: "ruby" }));
  const join = await second.waitFor((m) => m.type === "input" && m.event.type === "joined");
  assert.equal(join.playerId, "migration-player-a");
  const reset = await first.waitFor((m) => m.type === "reset");
  assert.equal(reset.paylod.landers[0].name, "Migration A");

  second.socket.send(packr.pack({ type: "join", gameId: init.payload.id, time: join.time, name: "Migration B", color: "blue" }));
  await first.waitFor((m) => m.type === "input" && m.event.playerId === "migration-player-b");
  const secondReset = await second.waitFor((m) => m.type === "reset");
  assert.equal(secondReset.paylod.landers.length, 2);

  first.socket.send(JSON.stringify({ type: "input", gameId: init.payload.id, time: secondReset.time, playerId: "migration-player-a", event: { type: "thrust", dir: "up", active: true } }));
  await second.waitFor((m) => m.type === "input" && m.event.type === "thrust");

  second.socket.send(packr.pack({ type: "chat", gameId: init.payload.id, time: secondReset.time, playerId: "migration-player-b", message: "PartyServer migration works" }));
  const chat = await first.waitFor((m) => m.type === "chat");
  assert.equal(chat.message, "PartyServer migration works");

  const isolated = connect(`${room}-isolated`, "migration-player-c", "main");
  const isolatedInit = await isolated.waitFor((m) => m.type === "init");
  assert.notEqual(isolatedInit.payload.id, init.payload.id);
  assert.equal(isolatedInit.payload.landers.length, 0);

  const partial = await second.waitFor((m) => m.type === "partial");
  await first.close();
  const laterPartial = await second.waitFor((m) => m.type === "partial" && m.time > partial.time);
  second.socket.send(JSON.stringify({
    type: "request-reset", gameId: init.payload.id, time: laterPartial.time,
    options: secondReset.paylod.options, resetOptions: { preserveMap: true, preserveScores: true },
  }));
  const pending = await second.waitFor((m) => m.type === "reset-pending" && m.cause === "requested");
  await second.close();

  const reopened = connect(room, "migration-player-d", "main");
  const reopenedInit = await reopened.waitFor((m) => m.type === "init");
  assert.notEqual(reopenedInit.payload.id, init.payload.id);
  assert.equal(reopenedInit.payload.landers.length, 0);
  assert.equal(reopenedInit.time, 0);
  const afterPendingReset = await reopened.waitFor(
    (m) => m.type === "partial" && Date.now() > pending.resetTimestamp + 1000,
    15000,
  );
  assert.equal(afterPendingReset.gameId, reopenedInit.payload.id);
  assert.equal(afterPendingReset.payload.landers.length, 0);

  console.log("PASS: health, legacy and current routes, binary physics snapshots, two-player joins, JSON input, MessagePack input/chat, room isolation, simulation after disconnect, empty-room cleanup, pending-reset cleanup, and reconnect.");
} finally {
  await Promise.all(clients.map((client) => client.close()));
}
