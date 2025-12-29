import SettingsDialog from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { useBookUpload } from "@/hooks/use-book-upload";
import { useT } from "@/hooks/use-i18n";
import { useSafeAreaInsets } from "@/hooks/use-safe-areaInsets";
import { useTheme } from "@/hooks/use-theme";
import { useUICSS } from "@/hooks/use-ui-css";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLibraryStore } from "@/store/library-store";
import clsx from "clsx";
import { Plus, Upload as UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import BookItem from "./components/book-item";
import SearchToggle from "./components/search-toggle";
import Upload from "./components/upload";
import { useBooksFilter } from "./hooks/use-books-filter";
import { useBooksOperations } from "./hooks/use-books-operations";
import { useLibraryUI } from "./hooks/use-library-ui";

export default function NewLibraryPage() {
  const t = useT();
  const { searchQuery, setSearchQuery, booksWithStatus, isLoading, refreshBooks } = useLibraryStore();
  const { isSettingsDialogOpen, toggleSettingsDialog } = useAppSettingsStore();
  const insets = useSafeAreaInsets();
  const isInitiating = useRef(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const { filteredBooks } = useBooksFilter(booksWithStatus, searchQuery);
  const { viewMode } = useLibraryUI();
  const { handleBookDelete, handleBookUpdate } = useBooksOperations(refreshBooks);

  useTheme({ systemUIVisible: true, appThemeColor: "base-200" });
  useUICSS();

  const { isDragOver, isUploading, handleDragOver, handleDragLeave, handleDrop, triggerFileSelect, handleFileSelect } =
    useBookUpload();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const initLibrary = async () => {
      try {
        await refreshBooks();
        setLibraryLoaded(true);
      } catch (error) {
        console.error("Error initializing library:", error);
        setLibraryLoaded(true);
      }
    };

    initLibrary();
    return () => {
      isInitiating.current = false;
    };
  }, [refreshBooks]);

  const visibleBooks = filteredBooks;
  const hasBooks = libraryLoaded && visibleBooks.length > 0;
  const hasLibraryBooks = libraryLoaded && booksWithStatus.length > 0;

  if (!insets || !libraryLoaded) {
    return null;
  }

  return (
    <div
      className={clsx(
        "flex h-dvh w-full bg-transparent transition-all duration-200",
        isDragOver && "bg-neutral-50 dark:bg-neutral-900/20",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-50/80 backdrop-blur-sm dark:bg-neutral-900/40">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-neutral-400 border-dashed bg-white/90 px-30 py-16 shadow-lg dark:border-neutral-500 dark:bg-neutral-800/90">
            <UploadIcon className="h-12 w-12 text-neutral-600 dark:text-neutral-400" />
            <div className="text-center">
              <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">
                {t("library.dragDrop.title", "拖放文件以上传")}
              </h3>
              <p className="text-neutral-600 text-sm dark:text-neutral-400">{t("library.dragDrop.desc", "松开以上传您的书籍")}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-60px)] flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-3 pt-3">
          <h3 className="font-bold text-3xl dark:border-neutral-700">{t("library.myBooks", "我的图书")}</h3>
          <div className="flex items-center gap-2">
            <div className="w-44 sm:w-52 md:w-60">
              <SearchToggle searchQuery={searchQuery} onSearchChange={handleSearchChange} />
            </div>
            <Button onClick={triggerFileSelect} disabled={isUploading} variant="soft" size="sm">
              {isUploading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border border-white/30 border-t-white" />
                  {t("library.importing", "上传中...")}
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {t("library.addBook", "添加书籍")}
                </>
              )}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <Spinner loading />
          </div>
        )}

        {hasBooks ? (
          <div className="flex-1 overflow-y-auto p-3 pb-8">
            <div className="mx-auto">
              {searchQuery.trim() && (
                <div className="mb-4 text-base-content/70 text-sm">
                  {t("library.search.found", "找到 {count} 本书籍，搜索词：'{query}'", {
                    count: visibleBooks.length,
                    query: searchQuery,
                  })}
                </div>
              )}

              {viewMode === "grid" ? (
                <div className="grid 3xl:grid-cols-8 grid-cols-3 gap-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                  {visibleBooks.map((book) => (
                    <BookItem
                      key={book.id}
                      book={book}
                      viewMode={viewMode}
                      onDelete={handleBookDelete}
                      onUpdate={handleBookUpdate}
                      onRefresh={refreshBooks}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleBooks.map((book) => (
                    <BookItem
                      key={book.id}
                      book={book}
                      viewMode={viewMode}
                      onDelete={handleBookDelete}
                      onUpdate={handleBookUpdate}
                      onRefresh={refreshBooks}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : hasLibraryBooks && searchQuery.trim() ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 px-2 text-center">
            <div className="text-base-content/50 text-lg">
              {t("library.search.empty", "没有找到 '{query}' 相关的书籍", { query: searchQuery })}
            </div>
            <div className="mt-2 text-base-content/40 text-sm">{t("library.search.hint", "尝试使用不同的关键词搜索")}</div>
          </div>
        ) : (
          <div className="flex-1 px-2">
            <Upload
              isDragOver={isDragOver}
              isUploading={isUploading}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleFileSelect={handleFileSelect}
              triggerFileSelect={triggerFileSelect}
            />
          </div>
        )}
      </div>

      <SettingsDialog open={isSettingsDialogOpen} onOpenChange={toggleSettingsDialog} />
    </div>
  );
}
