import type { Room } from "colyseus.js";
import {
  secretHitlerDescriptor,
  SH_PRIVATE,
  type HandPrivatePayload,
  type InvestigateResultPayload,
  type PeekResultPayload,
  type RolePrivatePayload,
} from "@tabletop-games/shared";
import { registerClientGame } from "../registry.js";
import { SecretHitlerGame } from "./GameComponent.js";
import { usePrivateInfo } from "./privateInfo.js";
import cardArt from "../../assets/games/secret-hitler/card.svg";
// Game-scoped CSS — Vite collects this into the main bundle so we don't
// need a separate <link> tag. Keeping SH styles next to SH code means
// adding a new game doesn't bloat the platform's global stylesheet.
import "./secret-hitler.css";

/**
 * Register handlers for SH's server-pushed private messages. Called from
 * App.tsx as soon as the room exists, so role/hand messages sent on game
 * start aren't lost while the GameView component is still mounting.
 */
function setupRoomHandlers(room: Room): void {
  room.onMessage(SH_PRIVATE.ROLE, (p: RolePrivatePayload) => {
    usePrivateInfo.getState().setRole(p.role, p.knownAllies ?? []);
  });
  room.onMessage(SH_PRIVATE.PRESIDENT_HAND, (p: HandPrivatePayload) => {
    usePrivateInfo.getState().setPresidentHand(p.cards);
  });
  room.onMessage(SH_PRIVATE.CHANCELLOR_HAND, (p: HandPrivatePayload) => {
    usePrivateInfo.getState().setChancellorHand(p.cards);
  });
  room.onMessage(SH_PRIVATE.PEEK_RESULT, (p: PeekResultPayload) => {
    usePrivateInfo.getState().setPeekResult(p.cards);
  });
  room.onMessage(SH_PRIVATE.INVESTIGATE_RESULT, (p: InvestigateResultPayload) => {
    usePrivateInfo.getState().setInvestigateResult(p);
  });
}

registerClientGame({
  descriptor: secretHitlerDescriptor,
  Component: SecretHitlerGame,
  setupRoomHandlers,
  card: {
    art: cardArt,
    tagline: "Hidden roles. Open lies.",
    accent: "#d4a23a",
  },
});
