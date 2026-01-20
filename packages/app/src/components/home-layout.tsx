import SettingsDialog from "@/components/settings/settings-dialog";
import { useBookUpload } from "@/hooks/use-book-upload";
import { useSafeAreaInsets } from "@/hooks/use-safe-areaInsets";
import EmbeddingModelPrompt from "@/pages/library/components/embedding-model-prompt";
import ChatPage from "@/pages/chat";
import LibraryPage from "@/pages/library";
import SkillsPage from "@/pages/skills";
import StatisticsPage from "@/pages/statistics";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLibraryStore } from "@/store/library-store";
import { useLlamaStore } from "@/store/llama-store";
import { useModeStore } from "@/store/mode-store";
import { PRESET_EMBEDDING_MODELS } from "@/constants/preset-models";
import { downloadModelFile, listLocalModels } from "@/services/model-service";
import { enqueueVectorization } from "@/services/vectorization-queue";
import { eventDispatcher } from "@/utils/event";
import clsx from "clsx";
import { Upload as UploadIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes } from "react-router";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./sidebar";

const NotesPage = () => (
  <div className="flex-1 space-y-6 p-4">
    <div className="space-y-2">
      <h1 className="font-bold text-3xl text-neutral-900 dark:text-neutral-100">笔记</h1>
      <p className="text-neutral-600 dark:text-neutral-400">笔记功能开发中...</p>
    </div>
  </div>
);

const HomeLayout = () => {
  const { refreshBooks } = useLibraryStore();
  const { isSettingsDialogOpen, toggleSettingsDialog, settings, setSettings } = useAppSettingsStore();
  const { mode } = useModeStore();
  const insets = useSafeAreaInsets();
  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useBookUpload();
  const isSimpleMode = mode === "simple";

  const isInitiating = useRef(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [showEmbeddingPrompt, setShowEmbeddingPrompt] = useState(false);
  const [pendingVectorizeIds, setPendingVectorizeIds] = useState<string[]>([]);

  const {
    embeddingModels,
    modelPath,
    vectorModelEnabled,
    getSelectedVectorModel,
    setModelPath,
    setDownloadState,
    updateDownloadProgress,
    updateEmbeddingModel,
    hasHydrated,
    initializeEmbeddingService,
  } = useLlamaStore();

  const embeddingModel = useMemo(
    () => PRESET_EMBEDDING_MODELS.find((model) => model.id === "embeddinggemma-300m") || null,
    [],
  );

  // 初始化 Embedding 服务器
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!hasHydrated) {
      console.log("等待持久化数据恢复...");
      return;
    }

    initializeEmbeddingService();
  }, [hasHydrated]);

  useEffect(() => {
    if (isInitiating.current) return;

    const initializeLibrary = async () => {
      isInitiating.current = true;
      try {
        await refreshBooks();
      } finally {
        setLibraryLoaded(true);
        isInitiating.current = false;
      }
    };

    initializeLibrary();
  }, [refreshBooks]);

  useEffect(() => {
    const unlistenProgress = listen<{ downloaded: number; total: number; percent: number; filename: string }>(
      "model-download-progress",
      (event) => {
        updateDownloadProgress({
          percent: event.payload.percent,
          downloaded: event.payload.downloaded,
          total: event.payload.total,
        });
      },
    );

    const unlistenComplete = listen<{ filename: string; success: boolean; error?: string }>(
      "model-download-complete",
      (event) => {
        const { filename, success } = event.payload;
        if (!embeddingModel || filename !== embeddingModel.filename) {
          return;
        }

        setDownloadState(null);
        if (!success) {
          return;
        }

        updateEmbeddingModel(filename, { downloaded: true });
        if (!modelPath) {
          setModelPath(filename);
        }

        if (pendingVectorizeIds.length > 0) {
          pendingVectorizeIds.forEach((bookId) => enqueueVectorization(bookId));
          setPendingVectorizeIds([]);
        }
      },
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, [embeddingModel, modelPath, pendingVectorizeIds, setDownloadState, setModelPath, updateDownloadProgress, updateEmbeddingModel]);

  const ensureEmbeddingAvailable = useCallback(async () => {
    if (vectorModelEnabled && getSelectedVectorModel()) {
      return true;
    }

    if (!embeddingModel) {
      return false;
    }

    const stored = embeddingModels.find((model) => model.id === embeddingModel.id);
    if (stored?.downloaded) {
      if (!modelPath) {
        setModelPath(embeddingModel.filename);
      }
      return true;
    }

    try {
      const localModels = await listLocalModels();
      if (localModels.includes(embeddingModel.filename)) {
        updateEmbeddingModel(embeddingModel.filename, { downloaded: true });
        if (!modelPath) {
          setModelPath(embeddingModel.filename);
        }
        return true;
      }
    } catch (error) {
      console.warn("Failed to check local embedding models:", error);
    }

    return false;
  }, [embeddingModel, embeddingModels, getSelectedVectorModel, modelPath, setModelPath, updateEmbeddingModel, vectorModelEnabled]);

  useEffect(() => {
    const handleBooksImported = async (event: CustomEvent) => {
      const books = (event.detail as { books?: { id: string; format?: string }[] } | undefined)?.books ?? [];
      if (!books.length) return;
      const ids = books
        .filter((book) => (book.format || "").toUpperCase() === "EPUB")
        .map((book) => book.id)
        .filter(Boolean);
      if (!ids.length) return;

      const available = await ensureEmbeddingAvailable();
      if (available) {
        ids.forEach((bookId) => enqueueVectorization(bookId));
        return;
      }

      if (settings.suppressEmbeddingDownloadPrompt) {
        return;
      }

      setPendingVectorizeIds((prev) => Array.from(new Set([...prev, ...ids])));
      setShowEmbeddingPrompt(true);
    };

    eventDispatcher.on("books-imported", handleBooksImported);
    return () => {
      eventDispatcher.off("books-imported", handleBooksImported);
    };
  }, [ensureEmbeddingAvailable, settings.suppressEmbeddingDownloadPrompt]);

  const handleConfirmEmbeddingDownload = useCallback(async () => {
    if (!embeddingModel) return;
    setShowEmbeddingPrompt(false);
    setDownloadState({
      isDownloading: true,
      filename: embeddingModel.filename,
      progress: { percent: 0, downloaded: 0, total: 0 },
    });

    try {
      await downloadModelFile(embeddingModel.url, embeddingModel.filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to start embedding model download:", message);
      setDownloadState(null);
    }
  }, [embeddingModel, setDownloadState]);

  const handleCancelEmbeddingPrompt = useCallback(() => {
    setShowEmbeddingPrompt(false);
    setPendingVectorizeIds([]);
  }, []);

  const handleNeverAskEmbeddingPrompt = useCallback(() => {
    setShowEmbeddingPrompt(false);
    setPendingVectorizeIds([]);
    setSettings({
      ...settings,
      suppressEmbeddingDownloadPrompt: true,
    });
  }, [setSettings, settings]);

  if (!insets || !libraryLoaded) {
    return null;
  }

  return (
    <div
      className={clsx(
        "flex h-dvh w-full rounded-xl bg-transparent p-1 py-0 transition-all duration-200",
        isDragOver && "bg-neutral-50 dark:bg-neutral-900/20",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex h-[calc(100vh-40px)] w-full rounded-xl border bg-background shadow-around">
        {isDragOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-50/80 backdrop-blur-sm dark:bg-neutral-900/40">
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-neutral-400 border-dashed bg-white/90 px-30 py-16 shadow-lg dark:border-neutral-500 dark:bg-neutral-800/90">
              <UploadIcon className="h-12 w-12 text-neutral-600 dark:text-neutral-400" />
              <div className="text-center">
                <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">拖放文件以上传</h3>
                <p className="text-neutral-600 text-sm dark:text-neutral-400">松开以上传您的书籍</p>
              </div>
            </div>
          </div>
        )}

        {!isSimpleMode && <Sidebar />}

        <div className="h-full flex-1 overflow-hidden p-1">
          <Routes>
            <Route
              path="/"
              element={
                <div className="flex h-full flex-1 flex-col rounded-xl border bg-background shadow-around">
                  <LibraryPage />
                </div>
              }
            />
            <Route
              path="/statistics"
              element={
                <div className="flex h-full flex-1 flex-col rounded-xl border bg-background shadow-around">
                  <StatisticsPage />
                </div>
              }
            />
            <Route
              path="/chat"
              element={
                <div className="flex h-full flex-1 flex-col overflow-hidden rounded-xl shadow-around">
                  <ChatPage />
                </div>
              }
            />
            <Route
              path="/notes"
              element={
                <div className="flex h-full flex-1 flex-col rounded-xl border bg-background shadow-around">
                  <NotesPage />
                </div>
              }
            />
            <Route
              path="/skills"
              element={
                <div className="flex h-full flex-1 flex-col rounded-xl border bg-background shadow-around">
                  <SkillsPage />
                </div>
              }
            />
          </Routes>
        </div>
      </div>

      <SettingsDialog open={isSettingsDialogOpen} onOpenChange={toggleSettingsDialog} />
      <EmbeddingModelPrompt
        open={showEmbeddingPrompt}
        onConfirm={handleConfirmEmbeddingDownload}
        onCancel={handleCancelEmbeddingPrompt}
        onNeverAsk={handleNeverAskEmbeddingPrompt}
      />
    </div>
  );
};

export default HomeLayout;
