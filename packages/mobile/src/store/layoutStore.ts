import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ActivePanel = "notes" | "chat" | "none";

interface LayoutStore {
  activePanel: ActivePanel;
  openPanel: (panel: Exclude<ActivePanel, "none">) => void;
  closePanel: () => void;
  togglePanel: (panel: Exclude<ActivePanel, "none">) => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set, get) => ({
      activePanel: "none",
      openPanel: (panel) => set({ activePanel: panel }),
      closePanel: () => set({ activePanel: "none" }),
      togglePanel: (panel) => {
        const { activePanel } = get();
        set({ activePanel: activePanel === panel ? "none" : panel });
      },
    }),
    {
      name: "layout-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activePanel: state.activePanel }),
    },
  ),
);
