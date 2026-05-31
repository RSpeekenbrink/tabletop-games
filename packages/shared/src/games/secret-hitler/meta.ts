import type { GameDescriptor } from "../registry.js";

export const SECRET_HITLER_ID = "secret-hitler";

export const secretHitlerDescriptor: GameDescriptor = {
  id: SECRET_HITLER_ID,
  name: "Secret Hitler",
  minPlayers: 5,
  maxPlayers: 10,
  description:
    "Social deduction game of fascist conspiracy and liberal counter-intelligence (5-10 players).",
};
