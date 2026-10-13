# PartyKit → PartyServer

The [official PartyKit migration guide](https://docs.partykit.io/guides/migrate-to-partyserver/)
announces that managed deployments and data exports end on **October 16, 2026**,
and hosted projects and their room data are deleted on **October 23, 2026**.
The supported replacement is PartyServer on Cloudflare Workers and Durable
Objects, deployed directly with Wrangler.

## What changed in Combat Lander

- `party/index.ts` exports `CombatLander extends Server`, plus a Worker fetch
  handler. The Durable Object binding `Main` routes `/parties/main/:room`.
- The Worker also rewrites `/party/:room` to the current route, preserving the
  existing `partysocket@0.0.25` client, connection IDs, and query parameters.
- `onMessage` now takes `(connection, message)`. Binary `ArrayBuffer` messages
  are converted to `Uint8Array` before MessagePack decoding.
- `wrangler.jsonc` replaces `partykit.json`. A new SQLite-backed Durable Object
  class is created in the selected Cloudflare account.
- The Rapier version, Wasm initialization, 60 Hz simulation, and message format
  are unchanged. Hibernation remains disabled for active in-memory simulations.
- Empty-room disposal clears both simulation and reset timers, so callbacks
  cannot later operate on a freed physics world.
- GitHub Actions deploys with Wrangler, using Cloudflare credentials instead of
  `PARTYKIT_TOKEN` and `PARTYKIT_LOGIN`.

The app never calls room storage. Games, scores, and chats live in memory and are
discarded after the last connection leaves. **No stored data export is needed.**
Players need to reconnect after the cutover; active matches will restart.

## Deploy the multiplayer server first

Use Node.js 22+ and a Cloudflare account with Workers enabled. This configuration
is for a new PartyServer deployment; do not use it to overwrite an existing
self-hosted PartyKit Worker with persisted Durable Objects.

```sh
npm ci
npm run typecheck
npm run build:server
npx wrangler login
npx wrangler whoami
npm run deploy:server
```

Confirm `whoami` reports your intended account. If you have multiple accounts,
set `CLOUDFLARE_ACCOUNT_ID` to the chosen account ID before deployment. Wrangler
prints the actual `https://combat-lander-party.<subdomain>.workers.dev` URL. Use
that returned URL; do not guess the account subdomain.

```sh
curl https://<returned-worker-host>/health
SERVER_URL=https://<returned-worker-host> npm run test:multiplayer
```

`/health` returns `{"status":"ok","server":"combat-lander"}`. The multiplayer
test creates temporary isolated rooms using the actual PartySocket client and
checks both route formats, binary physics snapshots, joins, inputs, chat, room
isolation, simulation after disconnect, and empty-room reconnects. All test
connections close afterward.

## Cut over the existing Vercel frontend

Keep the existing `combat-lander` Vercel project in `chungwus-projects` and its
`lander.gg` domain. Save the current `NEXT_PUBLIC_PARTYKIT_HOST` value for
rollback. Set the variable to the returned Worker **hostname**, without an
`https://` prefix or trailing path, first in Preview and then in Production.

In Vercel's project settings, change the variable and redeploy the frontend.
The variable is public and embedded at build time, so a running deployment does
not pick up a changed value until it is rebuilt.

If deploying locally, authenticate and explicitly select the existing project:

```sh
vercel login
vercel link --project combat-lander --scope chungwus-projects
vercel project inspect --non-interactive --scope chungwus-projects
```

Confirm the project and team before continuing. After setting the Preview
variable, build a preview:

```sh
vercel deploy --scope chungwus-projects
```

Open the same room in two browsers, join with two different players, fly and
fire rockets, send a chat, then disconnect and reconnect. Verify both players
see the same game and that the browser's WebSocket request goes to the new
Worker hostname. Also verify a different room URL starts a separate game.

Once the preview and live Worker pass, set the Production variable and stage a
production build without assigning the live domain:

```sh
vercel deploy --prod --skip-domain --scope chungwus-projects
```

Test that staged deployment, then promote the exact returned deployment URL:

```sh
vercel promote <staged-deployment-url> --scope chungwus-projects
```

Verify `https://lander.gg` connects to the Worker and multiplayer still works.
Do not promote a build that still references the old PartyKit hostname.

## Continuous deployment

Configure these GitHub Actions secrets on `chungwu/combat-lander`:

- `CLOUDFLARE_API_TOKEN`: a token scoped to the selected account with Workers
  Scripts edit and the account access needed for Wrangler deployment.
- `CLOUDFLARE_ACCOUNT_ID`: the selected Cloudflare account ID.

Configure credentials directly in GitHub; never commit tokens. The
`Deploy PartyServer` workflow runs on relevant changes to `main` and can also be
started manually. Its install, typecheck, dry-run build, and multiplayer test in
the local Workers runtime precede deployment.
Frontend deployments continue through the existing Vercel Git integration.

## Rollback

Before October 23, if the old PartyKit server is still available, restore the
previous public host value and roll back to the previous frontend deployment.
After PartyKit shuts down, roll back to a known-working PartyServer Worker
version and a frontend built with its hostname instead. Live game state is not
preserved across backend restarts or deployment changes.
