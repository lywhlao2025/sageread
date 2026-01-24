import { tauriStorageKey } from "@/constants/tauri-storage";
import { tauriStorage } from "@/lib/tauri-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface QuotaSnapshot {
  totalCount: number;
  usedCount: number;
  remainingCount: number;
}

interface AuthStore {
  token: string | null;
  userId: number | null;
  phone: string | null;
  quota: QuotaSnapshot | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  setAuth: (payload: { token: string; userId: number; phone: string }) => void;
  clearAuth: () => void;
  setQuota: (quota: QuotaSnapshot | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      phone: null,
      quota: null,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setAuth: ({ token, userId, phone }) => set({ token, userId, phone }),
      clearAuth: () => set({ token: null, userId: null, phone: null, quota: null }),
      setQuota: (quota) => set({ quota }),
    }),
    {
      name: tauriStorageKey.auth,
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        phone: state.phone,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
