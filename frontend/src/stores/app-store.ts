import { create } from 'zustand';
import type { RoomState } from '../../../packages/shared-types/src/index';

type AppState = {
  isSocketConnected: boolean;
  state: RoomState | null;
  setState: (state: RoomState) => void;
  clearState: () => void;
  setSocketConnected: (isSocketConnected: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isSocketConnected: false,
  state: null,
  setState: (state) => set({ state }),
  clearState: () => set({ state: null }),
  setSocketConnected: (isSocketConnected) => set({ isSocketConnected }),
}));
