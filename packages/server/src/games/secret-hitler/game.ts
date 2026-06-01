import type { Client } from "@colyseus/core";
import {
  LobbyState,
  SecretHitlerState,
  SHPlayer,
  SH_ACTION,
  SH_PRIVATE,
  type Policy,
  type Role,
  type Vote,
} from "@tabletop-games/shared";

import type { GameInstance } from "../GameInstance.js";
import type { TabletopRoom } from "../../rooms/TabletopRoom.js";
import {
  fascistBoardPowers,
  freshDeck,
  hitlerKnowsFascists,
  roleDistribution,
  shuffle,
} from "./rules.js";

export class SecretHitlerInstance implements GameInstance {
  private room: TabletopRoom;
  private roles = new Map<string, Role>();
  private drawPile: Policy[] = [];
  private discardPile: Policy[] = [];
  private presidentHand: Policy[] = [];
  private chancellorHand: Policy[] = [];
  private nextPresidentSeatIndex = 0;
  private overrideNextPresident: string | null = null;

  constructor(room: TabletopRoom) {
    this.room = room;
  }

  // ─── lifecycle ──────────────────────────────────────────────────────────

  onStart(): void {
    const root = this.root;
    const sh = new SecretHitlerState();

    // Build seat order + assign roles from the current lobby roster. Only
    // currently-connected players are seated; offline lingerers can stay in
    // the lobby list but don't participate in the game.
    const sessionIds: string[] = [];
    root.players.forEach((p) => {
      if (p.connected) sessionIds.push(p.sessionId);
    });
    const seatOrder = shuffle(sessionIds);
    for (const sid of seatOrder) sh.seatOrder.push(sid);

    const roleAssignments = shuffle(roleDistribution(seatOrder.length));
    seatOrder.forEach((sid, i) => {
      const lobbyP = root.players.get(sid)!;
      const shp = new SHPlayer();
      shp.sessionId = sid;
      shp.username = lobbyP.username;
      shp.connected = lobbyP.connected;
      shp.alive = true;
      sh.shPlayers.set(sid, shp);
      this.roles.set(sid, roleAssignments[i]!);
    });

    this.drawPile = freshDeck();
    sh.drawPileCount = this.drawPile.length;
    sh.discardPileCount = 0;

    sh.presidentSessionId = seatOrder[0]!;
    this.nextPresidentSeatIndex = seatOrder.length > 1 ? 1 : 0;

    root.secretHitler = sh;
    root.phase = "in-game";

    this.sendRoles();
    this.log(`Game started with ${seatOrder.length} players.`);
    this.startNomination();
  }

  dispose(): void {
    // No async resources held.
  }

  onPlayerDisconnect(client: Client): void {
    // Reconnect window is still open — mirror offline state so the SH UI
    // can gray the seat and tick a countdown. Do NOT eliminate here.
    const p = this.state?.shPlayers.get(client.sessionId);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
  }

  onPlayerLeave(client: Client, _consented: boolean): void {
    const sh = this.state;
    if (!sh) return;
    const p = sh.shPlayers.get(client.sessionId);
    if (!p) return;
    p.connected = false;

    if (sh.gamePhase === "game-over") return;

    p.alive = false;
    this.log(`${p.username} disconnected and was eliminated.`);
    if (this.roles.get(client.sessionId) === "hitler") {
      this.endGame("liberal", "hitler-executed");
      return;
    }

    if (client.sessionId === sh.presidentSessionId) {
      this.advancePresident();
      this.startNomination();
      return;
    }
    if (client.sessionId === sh.chancellorNomineeSessionId) {
      sh.chancellorNomineeSessionId = "";
      sh.electionTracker += 1;
      this.advancePresident();
      this.startNomination();
      return;
    }
    if (client.sessionId === sh.chancellorSessionId) {
      sh.chancellorSessionId = "";
      this.advancePresident();
      this.startNomination();
      return;
    }

    if (sh.gamePhase === "election" && sh.votes.size === this.aliveCount()) {
      this.resolveElection();
    }
  }

  onPlayerRejoin(client: Client): void {
    const sh = this.state;
    if (!sh) return;
    const p = sh.shPlayers.get(client.sessionId);
    if (p) {
      p.connected = true;
      p.disconnectedAt = 0;
    }

    const role = this.roles.get(client.sessionId);
    if (role) {
      const knownAllies = this.knownAlliesFor(client.sessionId, role);
      client.send(SH_PRIVATE.ROLE, { role, knownAllies });
    }

    if (sh.gamePhase === "legislative-president" && client.sessionId === sh.presidentSessionId) {
      client.send(SH_PRIVATE.PRESIDENT_HAND, { cards: [...this.presidentHand] });
    }
    if (sh.gamePhase === "legislative-chancellor" && client.sessionId === sh.chancellorSessionId) {
      client.send(SH_PRIVATE.CHANCELLOR_HAND, { cards: [...this.chancellorHand] });
    }
  }

  // ─── message dispatch ───────────────────────────────────────────────────

  onMessage(client: Client, type: string, payload: unknown): void {
    const sh = this.state;
    if (!sh || sh.gamePhase === "game-over") return;
    const data = (payload ?? {}) as Record<string, unknown>;
    switch (type) {
      case SH_ACTION.NOMINATE_CHANCELLOR:
        this.handleNominate(client, String(data.targetSessionId ?? ""));
        break;
      case SH_ACTION.VOTE:
        this.handleVote(client, data.vote as Vote);
        break;
      case SH_ACTION.DISCARD_POLICY:
        this.handleDiscard(client, Number(data.index));
        break;
      case SH_ACTION.ENACT_POLICY:
        this.handleEnact(client, Number(data.index));
        break;
      case SH_ACTION.PROPOSE_VETO:
        this.handleProposeVeto(client);
        break;
      case SH_ACTION.VETO_RESPONSE:
        this.handleVetoResponse(client, Boolean(data.agree));
        break;
      case SH_ACTION.INVESTIGATE_PLAYER:
        this.handleInvestigate(client, String(data.targetSessionId ?? ""));
        break;
      case SH_ACTION.EXECUTE_PLAYER:
        this.handleExecute(client, String(data.targetSessionId ?? ""));
        break;
      case SH_ACTION.CHOOSE_NEXT_PRESIDENT:
        this.handleChooseNextPresident(client, String(data.targetSessionId ?? ""));
        break;
      case SH_ACTION.ACKNOWLEDGE_PEEK:
        this.handleAcknowledgePeek(client);
        break;
    }
  }

  // ─── phase handlers ─────────────────────────────────────────────────────

  private handleNominate(client: Client, targetSid: string): void {
    const sh = this.state!;
    if (sh.gamePhase !== "nomination") return;
    if (client.sessionId !== sh.presidentSessionId) return;
    if (!targetSid || targetSid === client.sessionId) return;
    if (!this.isAlive(targetSid)) return;

    if (targetSid === sh.lastChancellorSessionId) return;
    if (this.aliveCount() > 5 && targetSid === sh.lastPresidentSessionId) return;

    sh.chancellorNomineeSessionId = targetSid;
    sh.gamePhase = "election";
    sh.votes.clear();
    sh.votesRevealed = false;
    sh.shPlayers.forEach((p) => {
      p.votedThisRound = false;
    });
    this.log(
      `${this.username(client.sessionId)} nominated ${this.username(targetSid)} as Chancellor. Vote.`,
    );
  }

  private handleVote(client: Client, vote: Vote): void {
    const sh = this.state!;
    if (sh.gamePhase !== "election") return;
    if (!this.isAlive(client.sessionId)) return;
    if (vote !== "ja" && vote !== "nein") return;
    if (sh.votes.has(client.sessionId)) return;

    sh.votes.set(client.sessionId, vote);
    const p = sh.shPlayers.get(client.sessionId);
    if (p) p.votedThisRound = true;

    if (sh.votes.size === this.aliveCount()) {
      this.resolveElection();
    }
  }

  private resolveElection(): void {
    const sh = this.state!;
    sh.votesRevealed = true;
    let ja = 0;
    let nein = 0;
    sh.votes.forEach((v) => (v === "ja" ? ja++ : nein++));
    const passed = ja > nein;
    this.log(`Vote: ${ja} Ja / ${nein} Nein → ${passed ? "PASS" : "FAIL"}.`);

    if (passed) {
      if (sh.fascistPolicies >= 3 && this.roles.get(sh.chancellorNomineeSessionId) === "hitler") {
        this.endGame("fascist", "hitler-elected-chancellor");
        return;
      }
      sh.chancellorSessionId = sh.chancellorNomineeSessionId;
      sh.lastPresidentSessionId = sh.presidentSessionId;
      sh.lastChancellorSessionId = sh.chancellorSessionId;
      sh.electionTracker = 0;
      this.startLegislativePresident();
    } else {
      sh.electionTracker += 1;
      if (sh.electionTracker >= 3) {
        this.log("Election tracker reached 3 — top policy auto-enacted.");
        const top = this.draw(1)[0]!;
        this.enactPolicy(top, true);
      } else {
        this.advancePresident();
        this.startNomination();
      }
    }
  }

  private startLegislativePresident(): void {
    const sh = this.state!;
    sh.gamePhase = "legislative-president";
    this.presidentHand = this.draw(3);
    const pres = this.room.clients.find((c) => c.sessionId === sh.presidentSessionId);
    pres?.send(SH_PRIVATE.PRESIDENT_HAND, { cards: [...this.presidentHand] });
    this.log(`${this.username(sh.presidentSessionId)} drew 3 policies. Discard one.`);
  }

  private handleDiscard(client: Client, idx: number): void {
    const sh = this.state!;
    if (sh.gamePhase !== "legislative-president") return;
    if (client.sessionId !== sh.presidentSessionId) return;
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.presidentHand.length) return;

    const [discarded] = this.presidentHand.splice(idx, 1);
    this.discardPile.push(discarded!);
    sh.discardPileCount = this.discardPile.length;
    this.chancellorHand = this.presidentHand;
    this.presidentHand = [];

    sh.gamePhase = "legislative-chancellor";
    const chan = this.room.clients.find((c) => c.sessionId === sh.chancellorSessionId);
    chan?.send(SH_PRIVATE.CHANCELLOR_HAND, { cards: [...this.chancellorHand] });
    this.log("President discarded. Chancellor must enact a policy.");
  }

  private handleEnact(client: Client, idx: number): void {
    const sh = this.state!;
    if (sh.gamePhase !== "legislative-chancellor") return;
    if (client.sessionId !== sh.chancellorSessionId) return;
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.chancellorHand.length) return;

    const enacted = this.chancellorHand[idx]!;
    const other = this.chancellorHand[1 - idx]!;
    this.chancellorHand = [];
    this.discardPile.push(other);
    sh.discardPileCount = this.discardPile.length;
    this.enactPolicy(enacted, false);
  }

  private handleProposeVeto(client: Client): void {
    const sh = this.state!;
    if (sh.gamePhase !== "legislative-chancellor") return;
    if (!sh.vetoUnlocked) return;
    if (client.sessionId !== sh.chancellorSessionId) return;
    sh.vetoProposed = true;
    sh.gamePhase = "veto-response";
    this.log("Chancellor proposed Veto.");
  }

  private handleVetoResponse(client: Client, agree: boolean): void {
    const sh = this.state!;
    if (sh.gamePhase !== "veto-response") return;
    if (client.sessionId !== sh.presidentSessionId) return;

    if (agree) {
      this.discardPile.push(...this.chancellorHand);
      this.chancellorHand = [];
      sh.discardPileCount = this.discardPile.length;
      this.log("President agreed to Veto. Both cards discarded.");
      sh.electionTracker += 1;
      sh.vetoProposed = false;
      if (sh.electionTracker >= 3) {
        this.log("Election tracker reached 3 — top policy auto-enacted.");
        const top = this.draw(1)[0]!;
        this.enactPolicy(top, true);
      } else {
        this.advancePresident();
        this.startNomination();
      }
    } else {
      sh.vetoProposed = false;
      sh.gamePhase = "legislative-chancellor";
      this.log("President refused Veto. Chancellor must enact.");
    }
  }

  private handleInvestigate(client: Client, targetSid: string): void {
    const sh = this.state!;
    if (sh.gamePhase !== "executive-action") return;
    if (sh.pendingExecutivePower !== "investigate") return;
    if (client.sessionId !== sh.presidentSessionId) return;
    if (!targetSid || targetSid === client.sessionId) return;
    if (!this.isAlive(targetSid)) return;
    const target = sh.shPlayers.get(targetSid);
    if (!target || target.investigated) return;

    target.investigated = true;
    const role = this.roles.get(targetSid)!;
    const party = role === "liberal" ? "liberal" : "fascist";
    const pres = this.room.clients.find((c) => c.sessionId === sh.presidentSessionId);
    pres?.send(SH_PRIVATE.INVESTIGATE_RESULT, { targetSessionId: targetSid, party });
    sh.executivePowerTargetSessionId = targetSid;
    this.log(
      `${this.username(client.sessionId)} investigated ${this.username(targetSid)}.`,
    );
    this.finishExecutivePower();
  }

  private handleExecute(client: Client, targetSid: string): void {
    const sh = this.state!;
    if (sh.gamePhase !== "executive-action") return;
    if (sh.pendingExecutivePower !== "execute") return;
    if (client.sessionId !== sh.presidentSessionId) return;
    if (!targetSid || targetSid === client.sessionId) return;
    if (!this.isAlive(targetSid)) return;

    const target = sh.shPlayers.get(targetSid)!;
    target.alive = false;
    sh.executivePowerTargetSessionId = targetSid;
    this.log(`${this.username(targetSid)} was executed.`);

    if (this.roles.get(targetSid) === "hitler") {
      this.endGame("liberal", "hitler-executed");
      return;
    }
    this.finishExecutivePower();
  }

  private handleChooseNextPresident(client: Client, targetSid: string): void {
    const sh = this.state!;
    if (sh.gamePhase !== "executive-action") return;
    if (sh.pendingExecutivePower !== "special-election") return;
    if (client.sessionId !== sh.presidentSessionId) return;
    if (!targetSid || targetSid === client.sessionId) return;
    if (!this.isAlive(targetSid)) return;

    this.overrideNextPresident = targetSid;
    sh.executivePowerTargetSessionId = targetSid;
    this.log(
      `${this.username(client.sessionId)} called a Special Election: ${this.username(targetSid)} will be the next President.`,
    );
    this.finishExecutivePower();
  }

  private handleAcknowledgePeek(client: Client): void {
    const sh = this.state!;
    if (sh.gamePhase !== "executive-action") return;
    if (sh.pendingExecutivePower !== "peek") return;
    if (client.sessionId !== sh.presidentSessionId) return;
    this.finishExecutivePower();
  }

  private finishExecutivePower(): void {
    const sh = this.state!;
    sh.pendingExecutivePower = "";
    sh.executivePowerTargetSessionId = "";
    this.advancePresident();
    this.startNomination();
  }

  // ─── enact / win logic ──────────────────────────────────────────────────

  private enactPolicy(p: Policy, viaTracker: boolean): void {
    const sh = this.state!;
    if (p === "liberal") {
      sh.liberalPolicies += 1;
      this.log(`Liberal policy enacted (${sh.liberalPolicies}/5).`);
    } else {
      sh.fascistPolicies += 1;
      this.log(`Fascist policy enacted (${sh.fascistPolicies}/6).`);
      if (sh.fascistPolicies === 5 && !sh.vetoUnlocked) {
        sh.vetoUnlocked = true;
        this.log("Veto power unlocked.");
      }
    }

    if (sh.liberalPolicies >= 5) {
      this.endGame("liberal", "five-liberal-policies");
      return;
    }
    if (sh.fascistPolicies >= 6) {
      this.endGame("fascist", "six-fascist-policies");
      return;
    }

    if (viaTracker) {
      sh.lastPresidentSessionId = "";
      sh.lastChancellorSessionId = "";
      sh.electionTracker = 0;
      this.advancePresident();
      this.startNomination();
      return;
    }

    if (p === "fascist") {
      const power = fascistBoardPowers(sh.seatOrder.length)[sh.fascistPolicies - 1] ?? null;
      if (power) {
        sh.pendingExecutivePower = power;
        sh.gamePhase = "executive-action";
        if (power === "peek") this.deliverPeek();
        return;
      }
    }
    this.advancePresident();
    this.startNomination();
  }

  private deliverPeek(): void {
    const sh = this.state!;
    this.reshuffleIfNeeded();
    const top3 = this.drawPile.slice(0, 3);
    const pres = this.room.clients.find((c) => c.sessionId === sh.presidentSessionId);
    pres?.send(SH_PRIVATE.PEEK_RESULT, { cards: top3 });
    this.log(`${this.username(sh.presidentSessionId)} is using Policy Peek.`);
  }

  // ─── seat / draw helpers ────────────────────────────────────────────────

  private startNomination(): void {
    const sh = this.state!;
    sh.gamePhase = "nomination";
    sh.chancellorNomineeSessionId = "";
    sh.chancellorSessionId = "";
    sh.votes.clear();
    sh.votesRevealed = false;
    sh.vetoProposed = false;
    sh.shPlayers.forEach((p) => {
      p.votedThisRound = false;
    });
    this.log(`${this.username(sh.presidentSessionId)} is President. Nominate a Chancellor.`);
  }

  private advancePresident(): void {
    const sh = this.state!;
    if (this.overrideNextPresident) {
      sh.presidentSessionId = this.overrideNextPresident;
      this.overrideNextPresident = null;
      return;
    }
    const order = sh.seatOrder;
    for (let i = 0; i < order.length; i++) {
      const idx = (this.nextPresidentSeatIndex + i) % order.length;
      const sid = order[idx]!;
      if (this.isAlive(sid)) {
        sh.presidentSessionId = sid;
        this.nextPresidentSeatIndex = (idx + 1) % order.length;
        return;
      }
    }
  }

  private draw(n: number): Policy[] {
    const drawn: Policy[] = [];
    for (let i = 0; i < n; i++) {
      this.reshuffleIfNeeded();
      drawn.push(this.drawPile.shift()!);
    }
    this.state!.drawPileCount = this.drawPile.length;
    return drawn;
  }

  private reshuffleIfNeeded(): void {
    if (this.drawPile.length < 3 && this.discardPile.length > 0) {
      this.drawPile = shuffle([...this.drawPile, ...this.discardPile]);
      this.discardPile = [];
      this.state!.discardPileCount = 0;
      this.state!.drawPileCount = this.drawPile.length;
      this.log("Deck reshuffled.");
    }
  }

  // ─── role-reveal / endgame ──────────────────────────────────────────────

  private sendRoles(): void {
    this.room.clients.forEach((client) => {
      const myRole = this.roles.get(client.sessionId);
      if (!myRole) return;
      const knownAllies = this.knownAlliesFor(client.sessionId, myRole);
      client.send(SH_PRIVATE.ROLE, { role: myRole, knownAllies });
    });
  }

  private knownAlliesFor(
    sessionId: string,
    role: Role,
  ): Array<{ sessionId: string; role: "fascist" | "hitler"; username: string }> {
    const fascistSids: string[] = [];
    let hitlerSid = "";
    this.roles.forEach((r, sid) => {
      if (r === "fascist") fascistSids.push(sid);
      if (r === "hitler") hitlerSid = sid;
    });
    const allies: Array<{ sessionId: string; role: "fascist" | "hitler"; username: string }> = [];
    const knowsHitler = hitlerKnowsFascists(this.state!.seatOrder.length);

    if (role === "fascist") {
      for (const sid of fascistSids) {
        if (sid === sessionId) continue;
        allies.push({ sessionId: sid, role: "fascist", username: this.username(sid) });
      }
      if (hitlerSid) {
        allies.push({ sessionId: hitlerSid, role: "hitler", username: this.username(hitlerSid) });
      }
    } else if (role === "hitler" && knowsHitler) {
      for (const sid of fascistSids) {
        allies.push({ sessionId: sid, role: "fascist", username: this.username(sid) });
      }
    }
    return allies;
  }

  private endGame(winner: "liberal" | "fascist", reason: string): void {
    const sh = this.state!;
    sh.gamePhase = "game-over";
    this.root.phase = "post-game";
    sh.winner = winner;
    sh.winReason = reason;
    this.roles.forEach((role, sid) => {
      sh.revealedRoles.set(sid, role);
    });
    this.log(`Game over. ${winner === "liberal" ? "Liberals" : "Fascists"} win: ${reason}.`);
  }

  // ─── tiny helpers ───────────────────────────────────────────────────────

  private get root(): LobbyState {
    return this.room.state;
  }

  private get state(): SecretHitlerState | undefined {
    return this.room.state.secretHitler;
  }

  private log(text: string): void {
    if (this.state) this.state.gameLog.push(text);
  }

  private username(sid: string): string {
    return this.state?.shPlayers.get(sid)?.username ?? this.root.players.get(sid)?.username ?? "?";
  }

  private isAlive(sid: string): boolean {
    const p = this.state?.shPlayers.get(sid);
    return !!p && p.alive;
  }

  private aliveCount(): number {
    let n = 0;
    this.state?.shPlayers.forEach((p) => {
      if (p.alive) n++;
    });
    return n;
  }
}
