const KEY = "tabletop-games:session";

export interface StoredSession {
  roomId: string;
  reconnectionToken: string;
  username: string;
}

// Stored in sessionStorage (not localStorage) so each browser tab owns its own
// reconnect token. localStorage is shared across tabs of the same origin, which
// caused a second tab opening or joining a different room to overwrite the
// first tab's token — making a later refresh of the first tab fail to
// reconnect. sessionStorage survives page refresh in the same tab but is
// scoped to that tab, which is exactly what we want.
export function getSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.roomId === "string" &&
      typeof parsed?.reconnectionToken === "string" &&
      typeof parsed?.username === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSession(session: StoredSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}
