export type Role = "liberal" | "fascist" | "hitler";
export type Party = "liberal" | "fascist";
export type Policy = "liberal" | "fascist";
export type Vote = "ja" | "nein";
export type ExecutivePower = "peek" | "investigate" | "special-election" | "execute";

export type GamePhase =
  | "night"
  | "nomination"
  | "election"
  | "election-result"
  | "legislative-president"
  | "legislative-chancellor"
  | "veto-response"
  | "executive-action"
  | "game-over";

export type WinReason =
  | "five-liberal-policies"
  | "six-fascist-policies"
  | "hitler-executed"
  | "hitler-elected-chancellor";
