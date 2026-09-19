import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@planning-poker/shared-types';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(`${apiUrl}/room`, {
  autoConnect: false,
  transports: ['websocket'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});