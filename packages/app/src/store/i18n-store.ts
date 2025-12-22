import { tauriStorageKey } from "@/constants/tauri-storage";
import { tauriStorage } from "@/lib/tauri-storage";
import { detectSystemLocale, resolveLocale, type LanguagePreference } from "@/i18n";
import type { Locale } from "@/i18n/dict";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface I18nState {
  preference: LanguagePreference;
  systemLocale: Locale;
  setPreference: (pref: LanguagePreference) => void;
  refreshSystemLocale: () => void;
  getResolvedLocale: () => Locale;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      preference: "system",
      systemLocale: detectSystemLocale(),
      setPreference: (preference) => set({ preference }),
      refreshSystemLocale: () => set({ systemLocale: detectSystemLocale() }),
      getResolvedLocale: () => resolveLocale(get().preference, get().systemLocale),
    }),
    {
      name: tauriStorageKey.i18n,
      storage: createJSONStorage(() => tauriStorage),
      partialize: (s) => ({ preference: s.preference }),
    },
  ),
);

