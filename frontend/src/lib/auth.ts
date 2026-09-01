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
