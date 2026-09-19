export function normalizeRoomCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const roomIndex = parts.indexOf('room');
    return roomIndex >= 0 ? (parts[roomIndex + 1] ?? '') : (parts.at(-1) ?? '');
  } catch {
    const parts = trimmed.split('/').filter(Boolean);
    const roomIndex = parts.indexOf('room');
    return roomIndex >= 0 ? (parts[roomIndex + 1] ?? '') : (parts.at(-1) ?? '');
  }
}
