const KEY = "tabletop-games:session";

export interface StoredSession {
  roomId: string;
  reconnectionToken: string;
  username: string;
}

export function getSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
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
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
