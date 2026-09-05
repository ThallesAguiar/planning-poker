import { create } from 'zustand';
import type { RoomRoleChangeRequest, RoomState } from '@planning-poker/shared-types';
import type { AccountRoom, AuthUser } from '../lib/auth';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type AiStatus = 'idle' | 'voting' | 'voted' | 'unavailable' | 'error';
export type RoomError = { code: string; message: string } | null;
export type FloatingReaction = {
  id: string;
  participantId: string;
  value: string;
  x: number;
  y: number;
};

type AppState = {
  isSocketConnected: boolean;
  connectionStatus: ConnectionStatus;
  state: RoomState | null;
  selfId: string;
  aiStatus: AiStatus;
  roomError: RoomError;
  account: AuthUser | null;
  accountToken: string;
  accountRooms: AccountRoom[];
  reactions: FloatingReaction[];
  confetti: boolean;
  confettiKey: number;
  roleRequests: RoomRoleChangeRequest[];
  setState: (state: RoomState) => void;
  patchParticipant: (participant: RoomState['participants'][number]) => void;
  clearState: () => void;
  setConnectionStatus: (connectionStatus: ConnectionStatus) => void;
  setSelfId: (selfId: string) => void;
  setAiStatus: (aiStatus: AiStatus) => void;
  setRoomError: (roomError: RoomError) => void;
  setAccountSession: (account: AuthUser, token: string) => void;
  clearAccountSession: () => void;
  setAccountRooms: (rooms: AccountRoom[]) => void;
  setSocketConnected: (isSocketConnected: boolean) => void;
  pushReaction: (participantId: string, value: string) => void;
  removeReaction: (id: string) => void;
  triggerConfetti: () => void;
  clearConfetti: () => void;
  setRoleRequests: (requests: RoomRoleChangeRequest[]) => void;
  upsertRoleRequest: (request: RoomRoleChangeRequest) => void;
  resolveRoleRequest: (requestId: string) => void;
};

const storedAccount = () => {
  try {
    return JSON.parse(localStorage.getItem('planning-poker-account') ?? 'null') as AuthUser | null;
  } catch {
    return null;
  }
};

export const useAppStore = create<AppState>((set) => ({
  isSocketConnected: false,
  connectionStatus: 'disconnected',
  state: null,
  selfId: '',
  aiStatus: 'idle',
  roomError: null,
  account: storedAccount(),
  accountToken: localStorage.getItem('planning-poker-account-token') ?? '',
  accountRooms: [],
  reactions: [],
  confetti: false,
  confettiKey: 0,
  roleRequests: [],
  setState: (state) => set({ state }),
  pushReaction: (participantId, value) =>
    set(({ reactions }) => {
      const id = `react-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      window.setTimeout(() => {
        set(({ reactions: next }) => ({ reactions: next.filter((item) => item.id !== id) }));
      }, 3400);
      return {
        reactions: [
          ...reactions.slice(-8),
          {
            id,
            participantId,
            value,
            x: 18 + Math.random() * 64,
            y: 18 + Math.random() * 52,
          },
        ],
      };
    }),
  removeReaction: (id) => set(({ reactions }) => ({ reactions: reactions.filter((item) => item.id !== id) })),
  triggerConfetti: () => set(({ confettiKey }) => ({ confetti: true, confettiKey: confettiKey + 1 })),
  clearConfetti: () => set({ confetti: false }),
  patchParticipant: (participant) =>
    set(({ state }) => {
      if (!state) return { state };
      const present = state.participants.some((item) => item.id === participant.id);
      return {
        state: present
          ? { ...state, participants: state.participants.map((item) => (item.id === participant.id ? { ...item, ...participant } : item)) }
          : { ...state, participants: [...state.participants, participant] },
      };
    }),
  clearState: () => set({ state: null, reactions: [], confetti: false, roleRequests: [] }),
  setRoleRequests: (roleRequests) => set({ roleRequests }),
  upsertRoleRequest: (request) =>
    set(({ roleRequests }) => {
      const exists = roleRequests.some((item) => item.id === request.id);
      return { roleRequests: exists ? roleRequests.map((item) => (item.id === request.id ? request : item)) : [...roleRequests, request] };
    }),
  resolveRoleRequest: (requestId) =>
    set(({ roleRequests }) => ({ roleRequests: roleRequests.filter((item) => item.id !== requestId) })),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus, isSocketConnected: connectionStatus === 'connected' }),
  setSelfId: (selfId) => set({ selfId }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  setRoomError: (roomError) => set({ roomError }),
  setAccountSession: (account, token) => {
    localStorage.setItem('planning-poker-account', JSON.stringify(account));
    localStorage.setItem('planning-poker-account-token', token);
    set({ account, accountToken: token });
  },
  clearAccountSession: () => {
    localStorage.removeItem('planning-poker-account');
    localStorage.removeItem('planning-poker-account-token');
    set({ account: null, accountToken: '', accountRooms: [] });
  },
  setAccountRooms: (accountRooms) => set({ accountRooms }),
  setSocketConnected: (isSocketConnected) => set({ isSocketConnected }),
}));