import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerSchema } from "../../state/PlayerSchema.js";

/**
 * Per-player game flags. Stored in a SEPARATE MapSchema on SecretHitlerState
 * (not in the lobby's PlayerSchema map) so we don't depend on Colyseus
 * runtime polymorphism of the lobby's player schema.
 */
export class SHPlayer extends PlayerSchema {
  @type("boolean") alive: boolean = true;
  @type("boolean") investigated: boolean = false;
  @type("boolean") votedThisRound: boolean = false;
}

/**
 * Public Secret Hitler state. Held as an OPTIONAL nested field on LobbyState
 * (LobbyState declares `@type(SecretHitlerState) secretHitler?`) so Colyseus
 * can serialize and patch it without us needing to swap the root state.
 *
 * Hidden information (roles, hands, peek/investigate results) is NOT in this
 * schema. The server sends those privately via client.send().
 */
export class SecretHitlerState extends Schema {
  @type("string") gamePhase: string = "night";

  @type("number") liberalPolicies: number = 0;
  @type("number") fascistPolicies: number = 0;
  @type("number") electionTracker: number = 0;
  @type("number") drawPileCount: number = 0;
  @type("number") discardPileCount: number = 0;

  @type(["string"]) seatOrder = new ArraySchema<string>();

  @type({ map: SHPlayer }) shPlayers = new MapSchema<SHPlayer>();

  @type("string") presidentSessionId: string = "";
  @type("string") chancellorNomineeSessionId: string = "";
  @type("string") chancellorSessionId: string = "";
  @type("string") lastPresidentSessionId: string = "";
  @type("string") lastChancellorSessionId: string = "";

  @type({ map: "string" }) votes = new MapSchema<string>();
  @type("boolean") votesRevealed: boolean = false;

  @type("boolean") vetoUnlocked: boolean = false;
  @type("boolean") vetoProposed: boolean = false;

  @type("string") pendingExecutivePower: string = "";
  @type("string") executivePowerTargetSessionId: string = "";

  @type("string") winner: string = "";
  @type("string") winReason: string = "";

  @type({ map: "string" }) revealedRoles = new MapSchema<string>();

  @type(["string"]) gameLog = new ArraySchema<string>();
}
