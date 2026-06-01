/**
 * Texture & 3D-model metadata for the Secret Hitler board — the single
 * source of truth that maps the game's art (under `../assets/`) into
 * three.js. Components import the URLs + helpers from here; nothing else
 * should hard-code an asset path or a UV calculation.
 *
 * The card art ships as rasterised sprite sheets: split a sheet into a
 * `cols × rows` grid and read cells left→right, top→bottom. The very last
 * cell of every sheet is the card back, the second-to-last is a blank.
 *
 *   role_cards.jpg   2940×3072  4×3=12  0 hitler · 1-3 fascist · 4-9 liberal · 10 blank · 11 back
 *   vote_cards.png   1470×2048  2×2=4   0 ja · 1 nein · 2 blank · 3 back
 *   party_cards.png  1470×2048  2×2=4   0 liberal · 1 fascist · 2 blank · 3 back
 *   policy_cards.png 1416×2048  2×2=4   0 liberal · 1 fascist · 2 blank · 3 back
 *   not_it_card.png  1324×2048  2×2     decorative; last cell = back
 *
 * The board/pile art is NOT sliced — each is a full texture mapped onto the
 * matching OBJ mesh's UVs:
 *
 *   tracker_liberal.png / tracker_facist_{5,7,9}.png  4096×2918  → tracker.obj
 *   draw_pile.png / discard_pile.png                  2202×1536  → discard_draw_pile.obj
 */
import * as THREE from "three";
import type { Role, Party, Policy, Vote } from "@tabletop-games/shared";

// ─── Asset URLs (Vite emits hashed, cache-busted filenames) ──────────────
import roleSheetUrl from "../assets/role_cards.jpg?url";
import voteSheetUrl from "../assets/vote_cards.png?url";
import partySheetUrl from "../assets/party_cards.png?url";
import policySheetUrl from "../assets/policy_cards.png?url";
import notItSheetUrl from "../assets/not_it_card.png?url";
import trackerLiberalUrl from "../assets/tracker_liberal.png?url";
import trackerFascist5Url from "../assets/tracker_facist_5.png?url";
import trackerFascist7Url from "../assets/tracker_facist_7.png?url";
import trackerFascist9Url from "../assets/tracker_facist_9.png?url";
import drawPileUrl from "../assets/draw_pile.png?url";
import discardPileUrl from "../assets/discard_pile.png?url";
import trackerObjUrl from "../assets/tracker.obj?url";
import pileObjUrl from "../assets/discard_draw_pile.obj?url";

// ─── Sprite-sheet grid descriptors ───────────────────────────────────────
export type SheetId = "role" | "vote" | "party" | "policy" | "notit";

export interface Sheet {
  url: string;
  cols: number;
  rows: number;
}

export const SHEETS: Record<SheetId, Sheet> = {
  role: { url: roleSheetUrl, cols: 4, rows: 3 },
  vote: { url: voteSheetUrl, cols: 2, rows: 2 },
  party: { url: partySheetUrl, cols: 2, rows: 2 },
  policy: { url: policySheetUrl, cols: 2, rows: 2 },
  notit: { url: notItSheetUrl, cols: 2, rows: 2 },
};

// ─── Logical card → cell index ───────────────────────────────────────────
export const ROLE_CELLS = {
  hitler: 0,
  fascist: [1, 2, 3] as const,
  liberal: [4, 5, 6, 7, 8, 9] as const,
  blank: 10,
  back: 11,
} as const;

export const VOTE_CELLS = { ja: 0, nein: 1, blank: 2, back: 3 } as const;
export const PARTY_CELLS = { liberal: 0, fascist: 1, blank: 2, back: 3 } as const;
export const POLICY_CELLS = { liberal: 0, fascist: 1, blank: 2, back: 3 } as const;

/** Stable FNV-1a hash so a given username always picks the same card variant. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** role_cards cell for a player's secret role; `seed` (username) picks a stable face variant. */
export function roleCardCell(role: Role, seed = ""): number {
  if (role === "hitler") return ROLE_CELLS.hitler;
  const variants = role === "fascist" ? ROLE_CELLS.fascist : ROLE_CELLS.liberal;
  return variants[hashString(seed) % variants.length];
}

export function partyCell(party: Party): number {
  return party === "liberal" ? PARTY_CELLS.liberal : PARTY_CELLS.fascist;
}

/** A player's party-membership card derived from their secret role. */
export function partyCellForRole(role: Role): number {
  return role === "liberal" ? PARTY_CELLS.liberal : PARTY_CELLS.fascist;
}

export function policyCell(policy: Policy): number {
  return policy === "liberal" ? POLICY_CELLS.liberal : POLICY_CELLS.fascist;
}

export function voteCell(vote: Vote): number {
  return vote === "ja" ? VOTE_CELLS.ja : VOTE_CELLS.nein;
}

// ─── UV math ─────────────────────────────────────────────────────────────
export interface CellUV {
  offset: [number, number];
  repeat: [number, number];
}

/**
 * Convert a zero-based grid cell into a three.js texture offset/repeat.
 * three's UV origin is bottom-left, but sheets are authored top-left and
 * read top→bottom, so the Y axis is flipped. `inset` (in UV units) shrinks
 * the window slightly to stop neighbouring cells bleeding in under mipmap /
 * anisotropic sampling. Pure — safe to unit-test without WebGL.
 */
export function cellUV(cols: number, rows: number, cell: number, inset = 0): CellUV {
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  return {
    offset: [col / cols + inset, 1 - (row + 1) / rows + inset],
    repeat: [1 / cols - inset * 2, 1 / rows - inset * 2],
  };
}

/**
 * Return a CLONE of `tex` windowed onto a single sheet cell. The source
 * texture is loaded once and cached by `useLoader`; cloning lets many cards
 * point at the same image with independent offset/repeat.
 */
export function sliceTexture(
  tex: THREE.Texture,
  cols: number,
  rows: number,
  cell: number,
): THREE.Texture {
  const clone = tex.clone();
  const img = tex.image as { width?: number; height?: number } | undefined;
  const longestEdge = Math.max(img?.width ?? 1024, img?.height ?? 1024);
  const inset = 0.5 / longestEdge; // ~half a texel
  const uv = cellUV(cols, rows, cell, inset);
  clone.offset.set(uv.offset[0], uv.offset[1]);
  clone.repeat.set(uv.repeat[0], uv.repeat[1]);
  clone.wrapS = THREE.ClampToEdgeWrapping;
  clone.wrapT = THREE.ClampToEdgeWrapping;
  clone.colorSpace = THREE.SRGBColorSpace;
  clone.anisotropy = 4;
  clone.needsUpdate = true;
  return clone;
}

// ─── Board / pile / OBJ exports (full-texture maps, no slicing) ───────────
export const TRACKER = {
  liberal: trackerLiberalUrl,
  /** Fascist board art varies by player count: ≤6 → _5, ≤8 → _7, else _9. */
  fascist(playerCount: number): string {
    if (playerCount <= 6) return trackerFascist5Url;
    if (playerCount <= 8) return trackerFascist7Url;
    return trackerFascist9Url;
  },
};

export const PILE = { draw: drawPileUrl, discard: discardPileUrl };
export const OBJ = { tracker: trackerObjUrl, pile: pileObjUrl };
