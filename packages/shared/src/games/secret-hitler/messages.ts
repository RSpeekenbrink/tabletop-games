import type { Policy, Role, Vote, Party } from "./types.js";

/**
 * Client -> Server: game actions sent inside the generic GAME_ACTION envelope.
 * The TabletopRoom forwards these to the SH instance which validates and routes.
 */
export const SH_ACTION = {
  NOMINATE_CHANCELLOR: "sh.nominate_chancellor",
  VOTE: "sh.vote",
  DISCARD_POLICY: "sh.discard_policy",
  ENACT_POLICY: "sh.enact_policy",
  PROPOSE_VETO: "sh.propose_veto",
  VETO_RESPONSE: "sh.veto_response",
  INVESTIGATE_PLAYER: "sh.investigate_player",
  EXECUTE_PLAYER: "sh.execute_player",
  CHOOSE_NEXT_PRESIDENT: "sh.choose_next_president",
  ACKNOWLEDGE_PEEK: "sh.acknowledge_peek",
} as const;

/**
 * Server -> Client: private messages (not in schema).
 * Sent with client.send() so only the targeted player receives them.
 */
export const SH_PRIVATE = {
  ROLE: "sh.role",
  PRESIDENT_HAND: "sh.president_hand",
  CHANCELLOR_HAND: "sh.chancellor_hand",
  PEEK_RESULT: "sh.peek_result",
  INVESTIGATE_RESULT: "sh.investigate_result",
} as const;

export interface NominateChancellorPayload {
  targetSessionId: string;
}

export interface VotePayload {
  vote: Vote;
}

export interface DiscardPolicyPayload {
  index: number;
}

export interface EnactPolicyPayload {
  index: number;
}

export interface VetoResponsePayload {
  agree: boolean;
}

export interface InvestigatePayload {
  targetSessionId: string;
}

export interface ExecutePayload {
  targetSessionId: string;
}

export interface ChooseNextPresidentPayload {
  targetSessionId: string;
}

export interface RolePrivatePayload {
  role: Role;
  knownAllies: Array<{ sessionId: string; role: "fascist" | "hitler"; username: string }>;
}

export interface HandPrivatePayload {
  cards: Policy[];
}

export interface PeekResultPayload {
  cards: Policy[];
}

export interface InvestigateResultPayload {
  targetSessionId: string;
  party: Party;
}
