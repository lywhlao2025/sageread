import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import ReaderLayout from "./components/reader-layout.tsx";
import { flushAllWrites } from "./lib/tauri-storage.ts";
import { startPublicHighlightRetryLoop } from "./services/public-highlights-service.ts";
import { initAnalytics } from "./services/analytics-service.ts";
import { mountFontsToMainApp } from "./utils/font.ts";
import { useI18nStore } from "./store/i18n-store.ts";

const queryClient = new QueryClient();

import "./index.css";

mountFontsToMainApp();
startPublicHighlightRetryLoop();
initAnalytics();

// Keep system locale in sync (used when language preference is "system").
useI18nStore.getState().refreshSystemLocale();
if (typeof window !== "undefined") {
  window.addEventListener("languagechange", () => {
    useI18nStore.getState().refreshSystemLocale();
  });
}

window.addEventListener("beforeunload", () => {
  flushAllWrites().catch((error) => {
    console.error("Failed to flush writes on app close:", error);
  });
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <ReaderLayout />
    </HashRouter>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);
