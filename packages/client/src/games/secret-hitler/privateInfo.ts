import { create } from "zustand";
import type { Policy, Role, Party } from "@tabletop-games/shared";

export interface Ally {
  sessionId: string;
  role: "fascist" | "hitler";
  username: string;
}

interface PrivateInfoState {
  role: Role | null;
  knownAllies: Ally[];
  presidentHand: Policy[] | null;
  chancellorHand: Policy[] | null;
  peekResult: Policy[] | null;
  investigateResult: { targetSessionId: string; party: Party } | null;

  reset: () => void;
  setRole: (role: Role, allies: Ally[]) => void;
  setPresidentHand: (cards: Policy[]) => void;
  setChancellorHand: (cards: Policy[]) => void;
  setPeekResult: (cards: Policy[]) => void;
  clearPeekResult: () => void;
  setInvestigateResult: (r: { targetSessionId: string; party: Party }) => void;
  clearHands: () => void;
}

export const usePrivateInfo = create<PrivateInfoState>((set) => ({
  role: null,
  knownAllies: [],
  presidentHand: null,
  chancellorHand: null,
  peekResult: null,
  investigateResult: null,

  reset: () =>
    set({
      role: null,
      knownAllies: [],
      presidentHand: null,
      chancellorHand: null,
      peekResult: null,
      investigateResult: null,
    }),
  setRole: (role, knownAllies) => set({ role, knownAllies }),
  setPresidentHand: (cards) => set({ presidentHand: cards }),
  setChancellorHand: (cards) => set({ chancellorHand: cards }),
  setPeekResult: (cards) => set({ peekResult: cards }),
  clearPeekResult: () => set({ peekResult: null }),
  setInvestigateResult: (r) => set({ investigateResult: r }),
  clearHands: () => set({ presidentHand: null, chancellorHand: null }),
}));
