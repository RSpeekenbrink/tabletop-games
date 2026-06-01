# Secret Hitler

A 5-10 player social deduction game by Mike Boxleiter, Tommy Maranges,
Max Temkin, and Mac Schubert. Original rules at <https://www.secrethitler.com/>.

This document covers the rules as the platform implements them, and how
they map onto the code.

## Setup

### Roles

| Players | Liberals | Fascists | Hitler |
|---------|----------|----------|--------|
| 5       | 3        | 1        | 1      |
| 6       | 4        | 1        | 1      |
| 7       | 4        | 2        | 1      |
| 8       | 5        | 2        | 1      |
| 9       | 5        | 3        | 1      |
| 10      | 6        | 3        | 1      |

Hitler is on the fascist team but counts separately for win conditions.

### Night phase

Each player is privately told their own role. Additionally:

- **Fascists** (non-Hitler) are told who the other fascists are and who
  Hitler is.
- **Hitler** is told who the other fascists are **only** in 5- or
  6-player games. In 7-10p games Hitler does not know who their teammates
  are.

### Boards

Liberal track has 5 slots. Fascist track has 6 slots. Each fascist slot
1-5 may have an executive power that triggers when that slot is filled.
The board used depends on the player count:

| Slot | 5-6p          | 7-8p              | 9-10p              |
|------|---------------|-------------------|--------------------|
| 1    | -             | -                 | Investigate Loyalty |
| 2    | -             | Investigate Loyalty | Investigate Loyalty |
| 3    | Policy Peek   | Special Election  | Special Election   |
| 4    | Execution     | Execution         | Execution          |
| 5    | Execution     | Execution         | Execution          |

When the 5th fascist policy is enacted, the **Veto power** is unlocked
for the remainder of the game.

When the 6th fascist policy is enacted, fascists immediately win.

## The round

### 1. Nomination

The current President nominates a Chancellor from the seated alive
players. **Term limits**: the most recent Chancellor cannot be nominated.
The most recent President cannot be nominated either, **except** when
exactly 5 players remain alive. The President may nominate themselves
only when they are the only eligible Chancellor (rare in practice).

### 2. Election

All alive players vote Ja (yes) or Nein (no). The result is revealed when
all votes are in.

- **Majority Ja** (strictly more Ja than Nein - ties fail): the
  Government is elected.
  - If three or more fascist policies have been enacted **and** the
    elected Chancellor is Hitler, **fascists win immediately**
    (`hitler-elected-chancellor`).
  - Otherwise, the elected pair becomes the Government, the previous
    pair is recorded for term limits, and the election tracker resets
    to 0.
- **Majority Nein or tie**: the Government fails. The election tracker
  advances by 1.
  - If the tracker reaches 3, the top policy of the draw pile is
    enacted immediately, the tracker resets to 0, and term limits are
    cleared (any player can be nominated next round). This is the
    "country in chaos" rule.

### 3. Legislative session

If the Government was elected:

1. The President draws 3 policies from the draw pile (shuffled-discards
   if the draw pile has fewer than 3 cards remaining).
2. The President privately discards one and passes the remaining two to
   the Chancellor.
3. The Chancellor enacts one. The remaining card is discarded.

The enacted policy goes on the appropriate track.

### 4. Executive power (if applicable)

If the just-enacted policy was fascist and the current fascist slot has
a power assigned for the player count, the power triggers immediately:

- **Policy Peek**: the President privately sees the top three policies
  of the draw pile.
- **Investigate Loyalty**: the President chooses an alive player they
  have not previously investigated and is told that player's party
  (Liberal or Fascist). Hitler reads as Fascist.
- **Special Election**: the President names any other alive player as
  the next President for the following round only.
- **Execution**: the President names any other alive player. That
  player is killed (removed from voting and from nomination eligibility).
  - If the executed player is Hitler, **liberals win immediately**
    (`hitler-executed`).

After the power resolves the round ends.

### 5. Veto (when unlocked)

Once 5 fascist policies are enacted, the Chancellor may propose a Veto
during the legislative session instead of enacting. If the President
agrees, both remaining cards are discarded, the election tracker
advances by 1 (which can trigger the country-in-chaos rule), and the
round ends. If the President refuses, the Chancellor must enact a
policy as normal.

## Win conditions

The game ends immediately when any one of:

1. **`five-liberal-policies`**: 5 liberal policies enacted - **liberals
   win**.
2. **`six-fascist-policies`**: 6 fascist policies enacted - **fascists
   win**.
3. **`hitler-executed`**: Hitler is killed via the Execution power -
   **liberals win**.
4. **`hitler-elected-chancellor`**: Hitler is elected Chancellor while
   3 or more fascist policies are enacted - **fascists win**.

A player who disconnects mid-game and fails to reconnect within 60
seconds is treated as if executed. If that player was Hitler, this
triggers the `hitler-executed` win for liberals.

## Implementation

### Where the code lives

- **Shared** (`packages/shared/src/games/secret-hitler/`)
  - `meta.ts` - `secretHitlerDescriptor` (id, name, min/max players).
  - `types.ts` - `Role`, `Party`, `Policy`, `Vote`, `GamePhase`,
    `ExecutivePower`, `WinReason` union types.
  - `messages.ts` - `SH_ACTION` (client to server), `SH_PRIVATE`
    (server to client), and payload interfaces.
  - `state.ts` - `SHPlayer` (extends `PlayerSchema`) and
    `SecretHitlerState`. `SecretHitlerState` is a standalone
    `Schema`; it is held as an optional nested field on `LobbyState`
    (`@type(SecretHitlerState) secretHitler?`).
- **Server** (`packages/server/src/games/secret-hitler/`)
  - `rules.ts` - pure helpers: `roleDistribution`, `fascistBoardPowers`,
    `hitlerKnowsFascists`, `shuffle`, `freshDeck`.
  - `game.ts` - `SecretHitlerInstance` with the entire state machine.
  - `index.ts` - registers the module into the server registry.
- **Client** (`packages/client/src/games/secret-hitler/`)
  - `index.tsx` - registers the module and its `setupRoomHandlers` so
    private messages are caught the instant they arrive.
  - `GameComponent.tsx` - lazy-mounts the 3D board (`scene/SHScene`)
    full-bleed, with a thin HTML overlay (header, collapsible log,
    prompt strip) layered on top. Renders a fallback message if WebGL
    is unavailable.
  - `useSHState.ts` - snapshot hook over `room.state.secretHitler`.
  - `privateInfo.ts` - zustand store for role, hands, peek, investigate.
  - `scene/` - the Three.js / react-three-fiber board (see
    [3D board](#3d-board) below).
  - `ui/` - the HTML overlay components: `Header`, `GameLog`,
    `PromptStrip` (status text + non-spatial buttons), `GameOverPanel`.

### 3D board

The board is a Three.js scene rendered with react-three-fiber, replacing
the original 2D CSS board. It is lazy-loaded (`React.lazy`) so the heavy
three.js bundle stays out of the lobby/initial chunk. The 3D layer is a
new front-end only: every action still travels through the same
`MSG.GAME_ACTION` envelope, so the server contract is unchanged.

Files in `scene/`:

| File | Role |
|------|------|
| `textures.ts` | Single source of truth for the art: sprite-sheet grids, each logical card's cell index, the `cellUV()` slicing math, and the tracker / pile / OBJ URLs. |
| `useCardTexture.ts`, `useObj.ts` | Suspense loaders — a sliced sheet-cell texture, and an OBJ mesh's geometry. |
| `cardGeometry.tsx` | `<Card>` — a thin extruded rounded-rectangle with a textured face. |
| `useSHActions.ts` | The single dispatch path (nominate / vote / discard / …) plus the seat-eligibility helpers, shared by the scene and the prompt strip. |
| `SHScene.tsx` | The `<Canvas>` root: portrait-responsive camera, constrained `OrbitControls`, lighting, Suspense. Default export so it can be `React.lazy`'d. |
| `Table.tsx` | The felt table. |
| `Seats.tsx` | Avatars (drei `<Html>`) in a ring rotated so the local player sits at the front; gold / cyan turn highlights; tappable seat pads; revealed vote tokens. |
| `PolicyTrackers.tsx` | The liberal board plus the per-player-count fascist board (both `tracker.obj`), with enacted-policy markers and election-tracker pips. |
| `DeckStands.tsx` | Draw + discard stands (`discard_draw_pile.obj`) with live counts. |
| `LocalHand.tsx` | The local player's role + party cards plus the phase-driven interactive cards (Ja/Nein, policy hand, peek), glued to the camera at bottom-centre. |

Interaction is spatial: tap a glowing seat to nominate / investigate /
execute / special-elect, tap a card in your hand to vote / discard /
enact. Non-spatial choices (veto Yes/No, acknowledge peek, propose veto)
and all status narration live in the HTML `PromptStrip` bottom sheet.
`PlayerList` and `PrivateRoleCard` remain in `ui/` but are no longer
mounted — the seated avatars and the in-hand role card replace them.

The card art is rasterised sprite sheets sliced by `textures.ts`. Three's
UV origin is bottom-left while the sheets are authored top-left, so
`cellUV` flips the Y axis. See [assets.md](../assets.md) for the texture
and `.obj` import conventions.

### Public vs. private state

| What                                     | Where                              | Visibility |
|------------------------------------------|------------------------------------|------------|
| Phase, policy counts, election tracker, who's President / Chancellor, vote tallies after reveal, alive flags, public log | `SecretHitlerState` (schema)        | All clients |
| Your role + (if known) your allies        | `SH_PRIVATE.ROLE` typed message     | You only   |
| Your three-card President hand            | `SH_PRIVATE.PRESIDENT_HAND` message | You only   |
| Your two-card Chancellor hand             | `SH_PRIVATE.CHANCELLOR_HAND` message | You only  |
| Policy Peek result                        | `SH_PRIVATE.PEEK_RESULT` message    | You only   |
| Investigate Loyalty result                | `SH_PRIVATE.INVESTIGATE_RESULT` message | You only |
| Draw / discard pile **contents**          | Server-side only                    | Nobody     |
| Each player's actual role pre-game-over   | Server-side only                    | Nobody     |
| All roles at game-over                    | `SecretHitlerState.revealedRoles`   | All clients |

The split is enforced by separating the schema (broadcast to everyone)
from `client.send(...)` (per-recipient).

### Message types (client to server, inside `MSG.GAME_ACTION`)

| Action                              | Payload                                  |
|-------------------------------------|------------------------------------------|
| `SH_ACTION.NOMINATE_CHANCELLOR`     | `{ targetSessionId }`                    |
| `SH_ACTION.VOTE`                    | `{ vote: "ja" | "nein" }`                |
| `SH_ACTION.DISCARD_POLICY`          | `{ index: 0 | 1 | 2 }`                   |
| `SH_ACTION.ENACT_POLICY`            | `{ index: 0 | 1 }`                       |
| `SH_ACTION.PROPOSE_VETO`            | `{}`                                     |
| `SH_ACTION.VETO_RESPONSE`           | `{ agree: boolean }`                     |
| `SH_ACTION.INVESTIGATE_PLAYER`      | `{ targetSessionId }`                    |
| `SH_ACTION.EXECUTE_PLAYER`          | `{ targetSessionId }`                    |
| `SH_ACTION.CHOOSE_NEXT_PRESIDENT`   | `{ targetSessionId }`                    |
| `SH_ACTION.ACKNOWLEDGE_PEEK`        | `{}`                                     |

The server validates every action against the current phase and the
sender's role for the round. Anything invalid is silently ignored.

### Game-phase state machine

```
              onStart()
                 │
                 ▼
        ┌───── night ─────┐
        │                 │
        ▼                 │
   nomination ────────────┘
        │
        ▼
    election
        │
        ├── pass ────────────► legislative-president
        │                              │
        │                              ▼
        │                       legislative-chancellor
        │                              │
        │                              ├── propose veto ─► veto-response
        │                              │                       │
        │                              │                       ├── agree ─► (tracker advance) → nomination
        │                              │                       └── refuse ─► legislative-chancellor
        │                              │
        │                              ▼
        │                          (policy enacted)
        │                              │
        │                              ├── win? ─────────────► game-over
        │                              ├── fascist & power ─► executive-action
        │                              │                       │
        │                              │                       ▼
        │                              │                  (resolved)
        │                              │                       │
        │                              └───────────────────────┴─► nomination
        │
        └── fail ─► election tracker++ ─► (tracker == 3? auto-enact) ─► nomination
```

`gamePhase` on the schema reflects the active node; the client's 3D
scene and `PromptStrip` present a different interaction for each.

### Seat order and the next-President pointer

`SHPlayer` instances are stored in `shPlayers` keyed by `sessionId`.
`seatOrder` is an `ArraySchema<string>` of session ids in turn order
(shuffled once at game start).

The server keeps a `nextPresidentSeatIndex` private to the
`SecretHitlerInstance`. After each round it walks forward from that
index, skipping dead players, to find the next President.

Special Election overrides the next President exactly once: the
`overrideNextPresident` field is set to the chosen player. After their
round, `nextPresidentSeatIndex` (which was not touched) returns control
to the seat that originally followed the President who called the
Special Election.

### Deck and reshuffle

The draw pile starts as 11 fascist + 6 liberal policies, shuffled. On
each draw, if fewer than 3 cards remain, the discard pile is shuffled
back in. The schema exposes `drawPileCount` and `discardPileCount` only;
the actual contents never leave the server.

### Reconnection during a game

`onPlayerRejoin` re-sends the rejoining client's role, plus their
current hand if they are the President or Chancellor in a legislative
phase. The schema patches catch them up on everything public.

### Restart, return-to-lobby, and cancel

The host can:

- **Play again** (game-over only). Sends `MSG.RESTART_GAME`. The room
  creates a fresh `SecretHitlerInstance`, which builds a new
  `SecretHitlerState` and re-rolls roles.
- **Back to lobby** (game-over). Sends `MSG.RETURN_TO_LOBBY`. The room
  clears the nested SH state and sets `phase = "lobby"`.
- **Cancel game** (in-game, any phase except `game-over`). A small
  button in the header's right column. Same effect as Back to lobby:
  sends `MSG.RETURN_TO_LOBBY`, which the server accepts from any
  non-lobby phase. A `window.confirm` prompts before sending so a
  misclick doesn't abandon a round in progress.

All three are host-only. Non-host clients see no buttons at all - they
follow the host's decision when the state transitions.
