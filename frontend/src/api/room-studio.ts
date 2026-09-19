import { authHeaders } from "./auth";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type StudioProvider = {
  name: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string;
};

export type ResponseLanguage = "pt-BR" | "en";
export type StudioAgent = { name: string; avatar: string; systemPrompt: string; responseLanguage: ResponseLanguage };

export type RoomStudioSnapshot = {
  provider: StudioProvider | null;
  agent: StudioAgent | null;
  rules: string[];
  account: {
    provider: StudioProvider | null;
    agent: StudioAgent | null;
    rules: string[];
  };
  sources: {
    provider: "room" | "account" | "system";
    agent: "room" | "account" | "system";
    rules: "room" | "account" | "system";
  };
};

export type SaveProviderInput = {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  isActive?: boolean;
};

export type SaveAgentInput = {
  name: string;
  avatar?: string;
  systemPrompt?: string;
  responseLanguage?: ResponseLanguage;
};

export type TestProviderInput = { baseUrl?: string; apiKey?: string; model?: string };

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function getRoomStudio(token: string, roomId: string) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio`, { headers: authHeaders(token) });
  return parseJson<RoomStudioSnapshot>(response);
}

export async function claimGuestRoomOwnership(token: string, roomId: string, guestToken: string) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/claim-owner`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ guestToken }),
  });
  return parseJson<{ claimed: boolean; participantId: string }>(response);
}

export async function saveRoomStudioProvider(token: string, roomId: string, input: SaveProviderInput) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio/provider`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  return parseJson<StudioProvider>(response);
}

export async function testRoomStudioProvider(token: string, roomId: string, input: TestProviderInput) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio/provider/test`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  return parseJson<{ ok: boolean; latencyMs: number }>(response);
}

export async function saveRoomStudioAgent(token: string, roomId: string, input: SaveAgentInput) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio/agent`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  return parseJson<StudioAgent>(response);
}

export async function saveRoomStudioRules(token: string, roomId: string, contents: string[]) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio/rules`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ contents }),
  });
  return parseJson<string[]>(response);
}

export async function inheritRoomStudioProvider(token: string, roomId: string) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio/provider`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseJson<{ ok: boolean }>(response);
}

export async function inheritRoomStudioAgent(token: string, roomId: string) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio/agent`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseJson<{ ok: boolean }>(response);
}

export async function inheritRoomStudioRules(token: string, roomId: string) {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/ai-studio/rules`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseJson<{ ok: boolean }>(response);
}
