/**
 * Message type constants for client <-> server communication.
 * Keep these as string literal constants so both sides import the same values.
 */

export const MSG = {
  // Lobby / host actions
  SELECT_GAME: "select_game",
  START_GAME: "start_game",
  RESTART_GAME: "restart_game",
  RETURN_TO_LOBBY: "return_to_lobby",

  // Generic
  CHAT: "chat",

  // Game-scoped messages share a single envelope; payload.type identifies the
  // game-specific action so individual games don't need to register their own
  // top-level Colyseus message types.
  GAME_ACTION: "game_action",
} as const;

export type MsgType = (typeof MSG)[keyof typeof MSG];

export interface SelectGamePayload {
  gameId: string;
}

export interface ChatPayload {
  text: string;
}

export interface GameActionPayload {
  type: string;
  data?: unknown;
}

export type LobbyPhase = "lobby" | "in-game" | "post-game";
