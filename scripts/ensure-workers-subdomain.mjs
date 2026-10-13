import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || config.account_id;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Configure the CLOUDFLARE_API_TOKEN repository secret");
if (!/^[a-f0-9]{32}$/.test(accountId ?? "")) throw new Error("A valid Cloudflare account ID is required");

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`;
async function request(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, data: await response.json() };
}

let result = await request("GET");
if (!result.data.success) {
  if (!result.data.errors?.some((error) => error.code === 10007)) {
    throw new Error(`Reading workers.dev subdomain failed (${result.status}): ${JSON.stringify(result.data.errors)}`);
  }
  result = await request("PUT", { subdomain: "chungwu-combat-lander" });
  if (!result.data.success) {
    throw new Error(`Creating workers.dev subdomain failed (${result.status}): ${JSON.stringify(result.data.errors)}`);
  }
}

const subdomain = result.data.result?.subdomain;
if (!/^[a-z0-9][a-z0-9-]*$/.test(subdomain ?? "")) {
  throw new Error("Cloudflare did not return a valid workers.dev subdomain");
}
console.log(`Workers account address: ${subdomain}.workers.dev`);
console.log(`Multiplayer server address: https://${config.name}.${subdomain}.workers.dev`);
