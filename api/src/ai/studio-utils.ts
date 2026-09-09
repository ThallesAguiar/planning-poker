/** Mascara uma API key para exibição: "sk-abcdefghijkl1234" -> "sk-…1234". */
export const maskApiKey = (key: string) => (key.length <= 6 ? '••••' : `${key.slice(0, 3)}…${key.slice(-4)}`);

/** Garante protocolo + remove barra final: "openrouter.ai/api/v1/" -> "https://openrouter.ai/api/v1". */
export const normalizeBaseUrl = (url: string) => {
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/$/, '');
};