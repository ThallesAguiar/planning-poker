import { create } from 'zustand';
import type { RoomState } from '../../../packages/shared-types/src/index';

type AppState = {
  isSocketConnected: boolean;
  state: RoomState | null;
  setState: (state: RoomState) => void;
  setSocketConnected: (isSocketConnected: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isSocketConnected: false,
  state: null,
  setState: (state) => set({ state }),
  setSocketConnected: (isSocketConnected) => set({ isSocketConnected }),
}));
