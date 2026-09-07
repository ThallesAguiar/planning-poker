const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
  expiresAt: string;
};

export type AccountRoom = {
  id: string;
  code: string;
  name: string;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  role: string;
  joinedAt: string;
  lastSeenAt: string;
  participantId: string;
  isOwner: boolean;
  reportId: string | null;
  reportGeneratedAt: string | null;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export function authHeaders(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export async function registerAccount(input: { email: string; password: string; name: string; avatar?: string; claimGuestSessionToken?: string }) {
  const response = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<AuthSession>(response);
}

export async function loginAccount(input: { email: string; password: string }) {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<AuthSession>(response);
}

export async function loadMe(token: string) {
  const response = await fetch(`${API}/auth/me`, { headers: authHeaders(token) });
  return parseJson<AuthUser>(response);
}

export async function logoutAccount(token: string) {
  await fetch(`${API}/auth/logout`, { method: "POST", headers: authHeaders(token) });
}

export async function loadMyRooms(token: string) {
  const response = await fetch(`${API}/rooms/mine`, { headers: authHeaders(token) });
  return parseJson<AccountRoom[]>(response);
}

export async function updateProfile(token: string, input: { name?: string; avatar?: string }) {
  const response = await fetch(`${API}/auth/me`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  return parseJson<AuthUser>(response);
}

export type RoomDefaults = {
  tempoReflexaoSegundos?: number;
  tempoDiscussaoSegundos?: number;
  maxParticipantes?: number;
  permiteParticipantesIA?: boolean;
  iaDiscute?: boolean;
  votoAnonimo?: boolean;
  revelacaoAutomatica?: boolean;
  criterioConsenso?: string;
  deckType?: string;
  deckValues?: Array<number | string>;
};

const roomDefaultsKey = (scope: string) => `planning-poker-room-defaults:${scope}`;

export function getRoomDefaults(scope: string): RoomDefaults {
  try {
    return JSON.parse(localStorage.getItem(roomDefaultsKey(scope)) ?? "{}") as RoomDefaults;
  } catch {
    return {};
  }
}

export function setRoomDefaults(scope: string, config: RoomDefaults) {
  localStorage.setItem(roomDefaultsKey(scope), JSON.stringify(config));
}

export function clearRoomDefaults(scope: string) {
  localStorage.removeItem(roomDefaultsKey(scope));
}
