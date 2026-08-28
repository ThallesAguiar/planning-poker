import { create } from 'zustand';

type AppState = {
  isSocketConnected: boolean;
  setSocketConnected: (isSocketConnected: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isSocketConnected: false,
  setSocketConnected: (isSocketConnected) => set({ isSocketConnected }),
}));
