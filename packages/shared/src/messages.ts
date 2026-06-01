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
  APPOINT_HOST: "appoint_host",
  KICK_PLAYER: "kick_player",

  // Generic
  CHAT: "chat",

  // Game-scoped messages share a single envelope; payload.type identifies the
  // game-specific action so individual games don't need to register their own
  // top-level Colyseus message types.
  GAME_ACTION: "game_action",
} as const;

/**
 * WebSocket close codes the server uses to signal *why* a client was
 * disconnected. 4000–4999 is reserved by the WS spec for application use.
 * The client checks the code in its `room.onLeave` handler so it can clear
 * the persisted session for terminal kicks (vs. flaky-network drops, where
 * the session must be preserved for the reconnect window).
 */
export const LEAVE_CODE_KICKED = 4000;

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

export interface AppointHostPayload {
  sessionId: string;
}

export interface KickPlayerPayload {
  sessionId: string;
}

export type LobbyPhase = "lobby" | "in-game" | "post-game";
