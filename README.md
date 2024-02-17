# Combat Lander

This is a real time multiplayer game inspired by the lunar lander arcade game. You compete for points by landing before your opponents do, or by damaging their landers with your rockets!

You can play it at [lander.gg](https://lander.gg).

## Technical notes

A dump of random interesting tidbits.

### Architecture overview 

In each game, there's a server and multiple clients involved, all simulating what is happening in the game world.  The server is the authority and holds the authoritative state; it determines when a landing is successful, when a lander dies, etc.  The clients send input events to the server, and the server applies those events to its own simulation, and also broadcasts those events to other clients.  Periodically, the server also sends the entire state of the physics world to all clients, so the clients can make sure they have not strayed from the server.

### Partykit server

[Partykit](https://www.partykit.io/) is an awesome service that allows you to easily and quickly, on-demand, spin up a "server" (backed by Cloudflare Durable Objects), which we can use as the authoritative server for a game. Clients connect to the server via websockets, and data is shuffled between them in real time.  Whenever a new game / room is created (by going to a different lander.gg url), a new Partykit server is automatically created to host that game.

This was incredibly easy to get up and running!

### Rapier2D physics engine

Combat Lander uses the [Rapier2D](https://rapier.rs/) physics engine.  It is written in Rust, but used via wasm / javascript bindings.  Some features of the engine made it a good fit:

* It [guarantees deterministic outcomes](https://rapier.rs/docs/user_guides/javascript/determinism), which is important when we are trying to run physics simulations across a server and multiple clients and need the outcomes to all match up.
* It supports efficient [serialization and deserialization](https://rapier.rs/docs/user_guides/javascript/serialization) of the entire physics world state, which makes it easy to send snapshots of the state of the world between server and clients.
* It runs well in both browser and node.js runtimes (as well as the partykit / cloudflare worker runtime!)

### Syncing game state

The trickiest part is figuring out how to get the clients and the server to have the same game state (or as closely as possible!) while keeping the game play experience responsive.  

I had no experience making games, let alone real-time multiplayer games, so I had to make this stuff up as I go; suggestions are welcome!

The overall strategy is basically as follows:

* There is a "timestep", and incrementing counter.  Each step is an iteration of the physics world.  We run the physics simulation at 60 steps per second.
* The goal is to have all clients and server have the same "game state" at the same timestep.  At least, they should eventually converge, once no input events are being generated.
* Each client and server keeps a "snapshot" of the game state for each timestep, up to some number of snapshots. This makes it possible to perform git-rebase-like tasks when applying user inputs.  For example, a client is at step 100, and the server informs it that player B thrusted up at step 90.  The client will then rollback the world to the snapshot at step 90, apply player B's action, and then run the simulation forward again to 100.
* Whenever a client performs an action, it is applied locally, and sent to the server. The server forwards the action to all clients, so they can all apply it on their local state.  The server also applies the action on the server.  These events are small and cheap to send.
* Every once in a while (currently ~5 seconds), the server broadcasts its own game state to all clients, and clients will "switch over" to that game state. For example, server broadcasts that as of time 100, here's my game state. A client, maybe at 105 currently, will rollback to time 100, swap in the server state, and then replay forward to 105, apply any local actions that had happened between 100 and 105 as well. If the server and client are "on the same page", there should be no difference.
* In the broadcast snapshot, the server will also send all the input events that it had seen from each client. That way the client can tell whether this snapshot had incorporated all the information that it knows.  For example, the server sends its snapshot as of time 100.  The client may see that it performed an action at time 98, but that action was not incorporated in this snapshot; so it knows that this snapshot will be "wrong", at least with respect to the client's own lander. In that case, the client will drop the snapshot, so that the player doesn't see their lander suddenly jump to an unexpected state.

### Game canvas rendering with Pixi.js

Pixi is used to render the game part. It is using html canvas and webgl and whatnot I dunno, but it works and seems to be fast!

### Game chrome rendered with React / mobx

Because it's a pain to build user interface with Pixi, I'm using React to render things like buttons, modals, inputs, etc.  The game objects, like `Lander`, have certain fields declared as `mobx` `observables`, so that when they change due to game state updates, the relevant React UI will also re-render to reflect those changes automatically.
