import { Client, Room } from "@colyseus/core";
import {
  LobbyState,
  MSG,
  PlayerSchema,
  type SelectGamePayload,
  type ChatPayload,
  type GameActionPayload,
} from "@tabletop-games/shared";

import { getGame } from "../games/registry.js";
import type { GameInstance } from "../games/GameInstance.js";

const RECONNECT_SECONDS = 60;
const SHORTCODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit ambiguous chars
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

      const playerCount = this.state.players.size;
      if (
        playerCount < module.descriptor.minPlayers ||
        playerCount > module.descriptor.maxPlayers
      ) {
        return;
      }

      this.game?.dispose();
      this.game = module.create(this);
      this.state.phase = "in-game";
      void this.game.onStart();
    });

    this.onMessage(MSG.RESTART_GAME, (client) => {
      if (!this.isHost(client)) return;
      const module = getGame(this.state.selectedGameId);
      if (!module) return;
      this.game?.dispose();
      this.game = module.create(this);
      this.state.phase = "in-game";
      void this.game.onStart();
    });

    this.onMessage(MSG.RETURN_TO_LOBBY, (client) => {
      if (!this.isHost(client)) return;
      this.game?.dispose();
      this.game = null;
      this.state.phase = "lobby";
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
      if (!this.game || this.state.phase !== "in-game") return;
      if (!payload?.type) return;
      this.game.onMessage(client, payload.type, payload.data);
    });
  }

  override onJoin(client: Client, options: JoinOptions = {}): void {
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

    if (consented) {
      this.removePlayer(client.sessionId);
      return;
    }

    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
      const rejoined = this.state.players.get(client.sessionId);
      if (rejoined) rejoined.connected = true;
      this.game?.onPlayerRejoin(client);
    } catch {
      this.removePlayer(client.sessionId);
      this.game?.onPlayerLeave(client, false);
    }
  }

  private removePlayer(sessionId: string): void {
    this.state.players.delete(sessionId);
    if (this.state.hostSessionId === sessionId) {
      const next = this.state.players.keys().next().value;
      this.state.hostSessionId = next ?? "";
    }
  }

  private isHost(client: Client): boolean {
    return client.sessionId === this.state.hostSessionId;
  }

  override onDispose(): void {
    this.game?.dispose();
    this.game = null;
  }
}
