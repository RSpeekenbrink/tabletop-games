import type { ExecutivePower, Policy, Role } from "@tabletop-games/shared";

export function roleDistribution(n: number): Role[] {
  let liberals: number;
  let fascists: number;
  switch (n) {
    case 5: liberals = 3; fascists = 1; break;
    case 6: liberals = 4; fascists = 1; break;
    case 7: liberals = 4; fascists = 2; break;
    case 8: liberals = 5; fascists = 2; break;
    case 9: liberals = 5; fascists = 3; break;
    case 10: liberals = 6; fascists = 3; break;
    default: throw new Error(`Invalid player count: ${n}`);
  }
  const roles: Role[] = [];
  for (let i = 0; i < liberals; i++) roles.push("liberal");
  for (let i = 0; i < fascists; i++) roles.push("fascist");
  roles.push("hitler");
  return roles;
}

/**
 * Power triggered when the i-th fascist policy (1-indexed) is enacted, for slots 1..5.
 * Slot 6 (6th fascist policy) is the auto-win and is not represented here.
 * Veto power unlocks separately once 5 fascist policies are on the board.
 */
export function fascistBoardPowers(n: number): Array<ExecutivePower | null> {
  if (n <= 6) return [null, null, "peek", "execute", "execute"];
  if (n <= 8) return [null, "investigate", "special-election", "execute", "execute"];
  return ["investigate", "investigate", "special-election", "execute", "execute"];
}

export function hitlerKnowsFascists(n: number): boolean {
  return n <= 6;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function freshDeck(): Policy[] {
  const deck: Policy[] = [];
  for (let i = 0; i < 6; i++) deck.push("liberal");
  for (let i = 0; i < 11; i++) deck.push("fascist");
  return shuffle(deck);
}
