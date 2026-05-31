import { Client, Room } from "@colyseus/core";
import {
  LobbyState,
  MSG,
  PlayerSchema,
  type SelectGamePayload,
  type ChatPayload,
  type GameActionPayload,
  type AppointHostPayload,
} from "@tabletop-games/shared";

import { getGame } from "../games/registry.js";
import type { GameInstance } from "../games/GameInstance.js";

const RECONNECT_SECONDS = 60;
const SHORTCODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SHORTCODE_LENGTH = 4;

function generateShortcode(): string {
  let out = "";
  for (let i = 0; i < SHORTCODE_LENGTH; i++) {
    out += SHORTCODE_ALPHABET[Math.floor(Math.random() * SHORTCODE_ALPHABET.length)];
  }
  return out;
}

interface JoinOptions {
  username?: string;
}

export class TabletopRoom extends Room<LobbyState> {
  override maxClients = 16;
  private game: GameInstance | null = null;

  override async onCreate(): Promise<void> {
    this.state = new LobbyState();
    this.state.shortcode = generateShortcode();
    await this.setMetadata({ shortcode: this.state.shortcode });

    this.onMessage(MSG.SELECT_GAME, (client, payload: SelectGamePayload) => {
      if (!this.isHost(client)) return;
      if (this.state.phase !== "lobby" && this.state.phase !== "post-game") return;
      this.state.selectedGameId = payload?.gameId ?? "";
    });

    this.onMessage(MSG.START_GAME, (client) => {
      if (!this.isHost(client)) return;
      if (this.state.phase === "in-game") return;
      const module = getGame(this.state.selectedGameId);
      if (!module) return;

      // Only connected players actually participate — offline players linger
      // in the seat list but shouldn't count toward (or block) game start.
      const playerCount = this.connectedPlayerCount();
      if (
        playerCount < module.descriptor.minPlayers ||
        playerCount > module.descriptor.maxPlayers
      ) {
        return;
      }

      this.game?.dispose();
      this.game = module.create(this);
      // game.onStart() swaps this.state to its own schema and sets phase.
      void this.game.onStart();
    });

    this.onMessage(MSG.RESTART_GAME, (client) => {
      if (!this.isHost(client)) return;
      if (this.state.phase !== "post-game") return;
      const module = getGame(this.state.selectedGameId);
      if (!module) return;
      this.game?.dispose();
      this.game = module.create(this);
      void this.game.onStart();
    });

    this.onMessage(MSG.RETURN_TO_LOBBY, (client) => {
      if (!this.isHost(client)) return;
      if (this.state.phase === "lobby") return;
      this.game?.dispose();
      this.game = null;
      this.state.secretHitler = undefined;
      this.state.phase = "lobby";
    });

    this.onMessage(MSG.APPOINT_HOST, (client, payload: AppointHostPayload) => {
      if (!this.isHost(client)) return;
      const targetSid = payload?.sessionId;
      if (!targetSid || targetSid === client.sessionId) return;
      const target = this.state.players.get(targetSid);
      if (!target || !target.connected) return;
      this.state.hostSessionId = targetSid;
    });

    this.onMessage(MSG.CHAT, (client, payload: ChatPayload) => {
      const text = (payload?.text ?? "").toString().slice(0, 500);
      if (!text.trim()) return;
      this.broadcast(MSG.CHAT, {
        sessionId: client.sessionId,
        username: this.state.players.get(client.sessionId)?.username ?? "?",
        text,
        at: Date.now(),
      });
    });

    this.onMessage(MSG.GAME_ACTION, (client, payload: GameActionPayload) => {
      if (!this.game) return;
      if (this.state.phase !== "in-game" && this.state.phase !== "post-game") return;
      if (!payload?.type) return;
      this.game.onMessage(client, payload.type, payload.data);
    });
  }

  override onJoin(client: Client, options: JoinOptions = {}): void {
    if (this.state.phase === "in-game") {
      throw new Error("Game in progress — wait for the round to end.");
    }
    const username = (options.username ?? "").toString().slice(0, 32).trim() || "Anon";
    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.username = username;
    player.connected = true;
    this.state.players.set(client.sessionId, player);

    if (!this.state.hostSessionId) {
      this.state.hostSessionId = client.sessionId;
    }
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;

    // Hand the host badge over immediately so the lobby keeps working while
    // the original host is offline. If they reconnect they're back as a
    // regular player; an explicit APPOINT_HOST can hand it back.
    if (this.state.hostSessionId === client.sessionId) {
      this.transferHostFrom(client.sessionId);
    }

    if (consented) {
      if (this.game && this.state.phase === "in-game") {
        // Mid-game voluntary leave is an elimination — let the game record it
        // but keep the seat visible (don't remove from the players map).
        this.game.onPlayerLeave(client, true);
      } else {
        this.removePlayer(client.sessionId);
      }
      return;
    }

    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
      const rejoined = this.state.players.get(client.sessionId);
      if (rejoined) rejoined.connected = true;
      this.game?.onPlayerRejoin(client);
    } catch {
      if (this.game && this.state.phase === "in-game") {
        this.game.onPlayerLeave(client, false);
      }
      // In lobby / post-game, keep the disconnected seat visible (matches how
      // in-game treats offline players). The current host can hand off via
      // APPOINT_HOST if they want to clean up.
    }
  }

  private removePlayer(sessionId: string): void {
    this.state.players.delete(sessionId);
    if (this.state.hostSessionId === sessionId) {
      this.transferHostFrom(sessionId);
    }
  }

  private transferHostFrom(currentHostSid: string): void {
    // Prefer the next connected player; fall back to any other player if
    // everyone else is offline so the badge is at least held by a known seat.
    let next = "";
    this.state.players.forEach((p, sid) => {
      if (next || sid === currentHostSid) return;
      if (p.connected) next = sid;
    });
    if (!next) {
      this.state.players.forEach((_p, sid) => {
        if (next || sid === currentHostSid) return;
        next = sid;
      });
    }
    this.state.hostSessionId = next;
  }

  private connectedPlayerCount(): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (p.connected) n++;
    });
    return n;
  }

  private isHost(client: Client): boolean {
    return client.sessionId === this.state.hostSessionId;
  }

  override onDispose(): void {
    this.game?.dispose();
    this.game = null;
  }
}
