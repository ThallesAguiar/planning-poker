const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// O token de sala e gravado como `planning-poker-token:{accountId|guest}:{roomCode}` em App.tsx
// (roomStorageKey). `roomCode` e o codigo de convite (ex.: 8F0024) — o `roomId` do banco nao serve
// de chave. O account.id usamos direto do localStorage (mesmo shape de app-store.ts).
function sessionScope() {
  try {
    const account = JSON.parse(localStorage.getItem('planning-poker-account') ?? 'null') as { id?: string } | null;
    return account?.id ?? 'guest';
  } catch { return 'guest'; }
}

function tokenForRoom(roomCode?: string) {
  const prefix = `planning-poker-token:${sessionScope()}:`;
  if (roomCode) {
    const inScope = localStorage.getItem(`${prefix}${roomCode}`);
    if (inScope) return inScope;
    // Caso o usuario tenha entrado como convidado (escopo guest) e depois logado na conta,
    // procura a mesma sala em qualquer escopo.
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('planning-poker-token:') && key.endsWith(`:${roomCode}`)) {
        return localStorage.getItem(key) ?? '';
      }
    }
    return '';
  }
  // Fallback: primeiro chaves do escopo atual desta conta; depois qualquer sala (compativel
  // com salas salvas antes do escopo).
  let anyRoom: string | null = null;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith('planning-poker-token:')) continue;
    if (key.startsWith(prefix)) return localStorage.getItem(key) ?? '';
    if (!anyRoom) anyRoom = key;
  }
  return anyRoom ? (localStorage.getItem(anyRoom) ?? '') : '';
}

export async function getReport(reportId: string, roomId?: string) {
  const response = await fetch(`${API}/reports/${encodeURIComponent(reportId)}`, { headers: { authorization: `Bearer ${tokenForRoom(roomId)}` } });
  if (!response.ok) throw new Error('Não foi possível carregar o relatório.');
  return response.json();
}

export async function downloadCsv(reportId: string, roomId?: string) {
  const response = await fetch(`${API}/reports/${encodeURIComponent(reportId)}/export.csv`, { headers: { authorization: `Bearer ${tokenForRoom(roomId)}` } });
  if (!response.ok) throw new Error('Exportação não autorizada.');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `planning-poker-${reportId}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

export async function downloadPdf(reportId: string, roomId?: string) {
  const response = await fetch(`${API}/reports/${encodeURIComponent(reportId)}/export.pdf`, { headers: { authorization: `Bearer ${tokenForRoom(roomId)}` } });
  if (!response.ok) throw new Error('Exportacao nao autorizada.');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `planning-poker-${reportId}.pdf`; anchor.click(); URL.revokeObjectURL(url);
}
