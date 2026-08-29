const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function tokenForRoom(roomId?: string) {
  if (roomId) return localStorage.getItem(`planning-poker-token:${roomId}`) ?? '';
  for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key?.startsWith('planning-poker-token:')) return localStorage.getItem(key) ?? ''; }
  return '';
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
