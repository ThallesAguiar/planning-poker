import { create } from 'zustand';
import type { RoomState } from '../../../packages/shared-types/src/index';
import type { AccountRoom, AuthUser } from '../lib/auth';

type AppState = {
  isSocketConnected: boolean;
  state: RoomState | null;
  account: AuthUser | null;
  accountToken: string;
  accountRooms: AccountRoom[];
  setState: (state: RoomState) => void;
  clearState: () => void;
  setAccountSession: (account: AuthUser, token: string) => void;
  clearAccountSession: () => void;
  setAccountRooms: (rooms: AccountRoom[]) => void;
  setSocketConnected: (isSocketConnected: boolean) => void;
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
  state: null,
  account: storedAccount(),
  accountToken: localStorage.getItem('planning-poker-account-token') ?? '',
  accountRooms: [],
  setState: (state) => set({ state }),
  clearState: () => set({ state: null }),
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
