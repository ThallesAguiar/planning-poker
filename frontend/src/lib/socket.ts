import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const socket = io(`${apiUrl}/room`, {
  autoConnect: false,
});
