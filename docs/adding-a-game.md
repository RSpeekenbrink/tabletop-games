# Adding a game

Each game is a self-contained module that lives in three sibling folders -
one per workspace - and registers itself in two registries (server and
client). The platform never references the game by name; it discovers it
through the registries.

## File layout

For a game with id `your-game`:

```
packages/
├── shared/src/games/your-game/
│   ├── index.ts        # barrel
│   ├── meta.ts         # GameDescriptor
│   ├── types.ts        # enums and unions
│   ├── messages.ts     # action + private message constants and payloads
│   └── state.ts        # Colyseus Schema for the game's public state
├── server/src/games/your-game/
│   ├── index.ts        # registerGame(...)
│   ├── rules.ts        # pure helpers (deck, distributions, win checks, ...)
│   └── game.ts         # YourGameInstance implements GameInstance
└── client/src/games/your-game/
    ├── index.tsx       # registerClientGame(...) + setupRoomHandlers
    ├── GameComponent.tsx
    ├── useYGState.ts   # state snapshot hook
    ├── privateInfo.ts  # zustand store for hidden info (optional)
    ├── scene/          # react-three-fiber pieces
    └── ui/             # React overlay components
```

Use the Secret Hitler module as a reference.

## Step 1: shared types and schema

### `meta.ts`

```ts
import type { GameDescriptor } from "../registry.js";

export const YOUR_GAME_ID = "your-game";

export const yourGameDescriptor: GameDescriptor = {
  id: YOUR_GAME_ID,
  name: "Your Game",
  minPlayers: 3,
  maxPlayers: 8,
  description: "One sentence about what the game is.",
};
```

### `types.ts`

Union types and enums used in both server and client code. Keep these
narrow.

### `messages.ts`

Two const objects: one for client → server actions (forwarded inside
`GAME_ACTION`), one for server → client private messages (sent via
`client.send`):

```ts
export const YG_ACTION = {
  DO_THING: "yg.do_thing",
  // ...
} as const;

export const YG_PRIVATE = {
  HAND: "yg.hand",
  // ...
} as const;

export interface DoThingPayload { ... }
export interface HandPrivatePayload { ... }
```

### `state.ts`

A standalone `Schema` for the game's public state. **Do not extend
`LobbyState`** - the root state cannot be swapped at runtime in Colyseus
0.16. Make this a sibling nested under `LobbyState`.

```ts
export class YourGameState extends Schema {
  @type("string") gamePhase: string = "setup";
  @type({ map: SomePerPlayerSchema }) ygPlayers = new MapSchema<...>();
  // ... public state only
}
```

Hidden info (player roles, hands, secret deck contents) does **not** go in
the schema. Send it with `client.send(...)`.

### Export from `packages/shared/src/index.ts`

Add `export * from "./games/your-game/index.js";`.

## Step 2: declare the nested field on `LobbyState`

Add one field to `packages/shared/src/state/LobbyState.ts`:

```ts
import { YourGameState } from "../games/your-game/state.js";

export class LobbyState extends Schema {
  // ...
  @type(YourGameState) yourGame?: YourGameState;
}
```

This is the only "core" file that changes when you add a game. Colyseus
needs the `@type` to know about the class at room creation time, so
true dynamic registration of nested schemas isn't possible.

## Step 3: server game module

### `rules.ts`

Pure functions only. Easy to unit-test, no Colyseus dependencies:
deck building, role distribution, win-condition checks, score tallies, ...

### `game.ts`

`YourGameInstance implements GameInstance`. Responsibilities:

1. **`onStart()`**: populate the nested state field on the root state:
   ```ts
   const yg = new YourGameState();
   // ... initialise from root.players, deal cards, etc.
   this.room.state.yourGame = yg;
   this.room.state.phase = "in-game";
   ```
   Then send any private setup messages (initial hands, roles) via
   `this.room.clients.forEach((c) => c.send(YG_PRIVATE.HAND, ...))`.
2. **`onMessage(client, type, payload)`**: validate that the sender is in
   the right seat for the current phase, then mutate state. Invalid
   messages are silently ignored.
3. **`onPlayerLeave(client, consented)`**: handle mid-game departures.
   Mark the player as eliminated; if their absence affects the round
   (current actor, pending vote, etc.), advance state.
4. **`onPlayerRejoin(client)`**: re-send any private info the rejoining
   player would have lost (their role, their current hand, etc.).
5. **`endGame(...)`**: set `state.yourGame.gamePhase = "game-over"`,
   `root.phase = "post-game"`, populate winner info, optionally reveal
   private info (e.g. roles) via a public schema field.

### `index.ts`

```ts
import { yourGameDescriptor } from "@tabletop-games/shared";
import { registerGame } from "../registry.js";
import { YourGameInstance } from "./game.js";

registerGame({
  descriptor: yourGameDescriptor,
  create: (room) => new YourGameInstance(room),
});
```

### Hook into server boot

In `packages/server/src/index.ts`, add the side-effect import alongside
existing games:

```ts
import "./games/your-game/index.js";
```

## Step 4: client game module

### State snapshot hook

`useYGState(room)`: mirror the pattern used by `useSHState`. Read from
`room.state.yourGame`. Return `null` when the field isn't populated yet.
Re-snapshot on every `room.onStateChange`.

Always guard for `undefined` on the nested field and its sub-fields - a
frame can pass between create-resolve and the first patch arriving.

### Private info store

If your game has hidden info (roles, hands), create a zustand store with
plain setters. Mirror `packages/client/src/games/secret-hitler/privateInfo.ts`.

### React UI

Standard React + CSS, with `react-three-fiber` for any 3D scene parts.
Use the existing `Table` from `packages/client/src/three/Table.tsx` or
build your own.

The overlay is a `<div className="game-overlay">` or a custom grid layout.
Set `pointer-events: none` on the outer wrapper and `auto` on interactive
children so canvas controls (orbit drag) still work through empty regions.

### Top-level component

```tsx
export function YourGame({ room }: { room: Room }) {
  const state = useYGState(room);
  useEffect(() => () => usePrivateInfo.getState().reset(), []);
  if (!state) return null;
  return (
    <>
      <YGScene state={state} />
      <div className="yg-overlay">
        {/* header, players, action panel, log */}
      </div>
    </>
  );
}
```

### Registration

```tsx
function setupRoomHandlers(room: Room): void {
  room.onMessage(YG_PRIVATE.HAND, (p) => {
    usePrivateInfo.getState().setHand(p.cards);
  });
  // ... other private message handlers
}

registerClientGame({
  descriptor: yourGameDescriptor,
  Component: YourGame,
  setupRoomHandlers,
});
```

`setupRoomHandlers` is critical: the server can push messages the instant
the game starts (in the same WebSocket burst as the state patch that
flips `phase` to `"in-game"`). Registering inside the component's
`useEffect` is too late - the messages would arrive before React mounts
the GameView.

### Hook into client boot

In `packages/client/src/main.tsx`, add the side-effect import:

```ts
import "./games/your-game/index.js";
```

## Step 5: verify

1. `npm run build` should succeed for all three workspaces.
2. `GET /api/games` should now list your game.
3. The lobby's game picker should show your game when the host is choosing.
4. A local end-to-end test: open enough browser tabs to satisfy your
   `minPlayers`, host picks your game, start, play through a turn.
5. Mid-game reconnect: refresh one tab and confirm the rejoining client
   gets its private info back.

## What you do **not** need to change

- `TabletopRoom`. The room knows nothing about specific games. It
  forwards `GAME_ACTION` messages to whichever `GameInstance` is active.
- The Express endpoints or the Dockerfile.
- The Lobby or GameView screens. They iterate the registries.
