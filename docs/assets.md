# Assets

Images, textures, audio, and other static files. The rule of thumb: an
asset lives next to the code that consumes it, not in a shared global
folder. This keeps each game self-contained (delete the game, delete its
assets in one rm) and lets the bundler verify imports at compile time.

## Where assets live

```
assets/                                          # source-of-truth originals
└── tabletop_games.{png,svg}                     # design files, large/raw exports

packages/client/src/
├── assets/                                      # client UI shell
│   └── branding/
│       └── tabletop_games.png                   # used by the Lobby header
└── games/<game-id>/
    └── assets/                                  # per-game art
        ├── cards/
        ├── board/
        └── icons/
```

Three locations, three roles:

| Location                                 | What goes here                                    | Consumed by                                   |
|------------------------------------------|---------------------------------------------------|-----------------------------------------------|
| `assets/` (repo root)                    | Design originals, raw exports, oversized masters  | Nothing at runtime — humans only              |
| `packages/client/src/assets/`            | App-shell visuals: logo, branding, generic icons  | Code in `packages/client/src/` (non-game)     |
| `packages/client/src/games/<id>/assets/` | Card faces, board textures, role icons, game SFX  | Only that game's React components              |

The repo-root `assets/` is the un-optimised vault. When the client needs
a file, **copy it** into the right package folder (resized / compressed /
renamed as needed) and import it from there. Keeping the originals
out-of-tree means anyone can hand-edit the master without rebuilding the
client, and the bundle never carries 4K source PNGs by accident.

## How to import an asset

Vite handles common asset types (`.png`, `.jpg`, `.svg`, `.webp`, `.gif`,
`.mp3`, `.glb`, …) as first-class modules. Import the file — Vite returns
a URL string and the bundler emits a hashed filename in `dist/assets/`:

```tsx
import logoUrl from "../assets/branding/tabletop_games.png";

export function Header() {
  return <img src={logoUrl} alt="Tabletop Games" />;
}
```

Benefits over `public/`-style absolute URLs:

1. **Compile-time check** — typos in the path are TypeScript / build
   errors, not 404s at runtime.
2. **Cache busting** — the emitted filename includes a content hash, so
   browsers always pick up updated art on deploy.
3. **Tree-shaking** — unused assets are not copied into `dist/`.
4. **Co-location** — the import path mirrors the file system, so moving a
   component moves its assets with it.

The TypeScript module declarations for these file types come from
`vite/client`, which is already in `packages/client/tsconfig.json` →
`compilerOptions.types`. No extra `.d.ts` needed.

## Game-specific assets

When you add a new game (see [adding-a-game.md](adding-a-game.md)), put
its art under `packages/client/src/games/<your-game-id>/assets/`. Group
by kind:

```
packages/client/src/games/your-game/
├── assets/
│   ├── cards/
│   │   ├── card-back.png
│   │   ├── liberal.png
│   │   └── fascist.png
│   ├── board/
│   │   └── policy-track.png
│   └── icons/
│       └── role-hitler.svg
├── scene/
└── ui/
```

Import them from the game's scene or UI components with relative paths
(`import x from "../assets/cards/liberal.png"`). Never reference another
game's assets — if two games legitimately need the same art, copy it into
each game's folder or promote it to `packages/client/src/assets/`.

## Server-side assets

The server is headless and doesn't render images. If a game ever needs
the server to know about its assets (e.g. canonical card IDs, deck
composition), encode that as **data** in the shared package
(`packages/shared/src/games/<id>/`) — not as image files. The server
references cards by id; the client maps id → texture.

## Naming

- Lowercase, hyphen-separated: `card-back.png`, not `CardBack.PNG`.
- The file extension matches the format (no `.jpg` files named `.png`).
- For multiple sizes, suffix with the dimension: `logo-32.png`,
  `logo-128.png`. Prefer SVG over multi-resolution PNG when the source
  is vector.

## What about `public/`?

Vite's default `public/` directory (files served at `/` untransformed) is
**not used** in this project. Every asset goes through `import` so we
get the cache-busting and validation benefits described above. The only
reason to add a `public/` folder later would be files referenced by URL
from outside our code — `robots.txt`, `favicon.ico`, or third-party
embeds that need a stable path.
