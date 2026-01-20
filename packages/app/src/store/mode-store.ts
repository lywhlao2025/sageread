import { tauriStorageKey } from "@/constants/tauri-storage";
import { tauriStorage } from "@/lib/tauri-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppMode = "simple" | "classic";

interface ModeStore {
  mode: AppMode | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  setMode: (mode: AppMode) => void;
}

export const useModeStore = create<ModeStore>()(
  persist(
    (set) => ({
      mode: null,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: tauriStorageKey.appMode,
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        mode: state.mode,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
