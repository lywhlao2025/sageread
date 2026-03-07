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
  email: string | null;
  quota: QuotaSnapshot | null;
  hasHydrated: boolean;
  isSwitching: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  setAuth: (payload: { token: string; userId: number; phone?: string | null; email?: string | null }) => void;
  clearAuth: () => void;
  setQuota: (quota: QuotaSnapshot | null) => void;
  startSwitchUser: () => void;
  stopSwitchUser: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      phone: null,
      email: null,
      quota: null,
      hasHydrated: false,
      isSwitching: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setAuth: ({ token, userId, phone, email }) => set({ token, userId, phone: phone ?? null, email: email ?? null }),
      clearAuth: () => set({ token: null, userId: null, phone: null, email: null, quota: null }),
      setQuota: (quota) => set({ quota }),
      startSwitchUser: () => set({ isSwitching: true }),
      stopSwitchUser: () => set({ isSwitching: false }),
    }),
    {
      name: tauriStorageKey.auth,
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        phone: state.phone,
        email: state.email,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
