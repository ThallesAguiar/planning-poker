export const routes = {
  home: '/',
  rooms: '/rooms',
  profile: '/profile',
  settings: '/settings',
  studio: '/studio',
  room: (code: string) => `/room/${encodeURIComponent(code)}`,
  roomStudio: (code: string) => `/rooms/${encodeURIComponent(code)}/studio`,
  report: (id: string, roomCode?: string) =>
    `/report/${encodeURIComponent(id)}${roomCode ? `/${encodeURIComponent(roomCode)}` : ''}`,
} as const;
