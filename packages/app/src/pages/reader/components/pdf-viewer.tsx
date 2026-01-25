import { useNotepad } from "@/components/notepad/hooks";
import { createBookNote, deleteBookNote } from "@/services/book-note-service";
import { iframeService } from "@/services/iframe-service";
import { useLocale, useT } from "@/hooks/use-i18n";
import { useReaderStore } from "@/pages/reader/components/reader-provider";
import { useSelectionTranslate } from "@/pages/reader/hooks/use-selection-translate";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { isCJKEnv, resolveTranslateTargetLang } from "@/utils/misc";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiCopy, FiHelpCircle, FiMessageCircle } from "react-icons/fi";
import { MdTranslate } from "react-icons/md";
import { NotebookPen } from "lucide-react";
import { PiHighlighterFill } from "react-icons/pi";
import { RiDeleteBinLine } from "react-icons/ri";
import AskAIPopup from "./annotator/ask-ai-popup";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
import { EventBus, PDFLinkService, PDFViewer } from "pdfjs-dist/legacy/web/pdf_viewer";
import "pdfjs-dist/legacy/web/pdf_viewer.css";
// Vite will emit the worker file and give us a URL
// biome-ignore lint/nursery/noImportAssign: asset import
// @ts-ignore
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";
import { useQueryClient } from "@tanstack/react-query";

type PopupPosition = { x: number; y: number };

interface PdfViewerProps {
  file: File;
  bookId: string;
}

GlobalWorkerOptions.workerSrc = workerSrc as string;

const PdfViewer: React.FC<PdfViewerProps> = ({ file, bookId }) => {
  const t = useT();
  const locale = useLocale();
  const { settings } = useAppSettingsStore();
  const { handleCreateNote } = useNotepad();
  const bookData = useReaderStore((state) => state.bookData);
  const queryClient = useQueryClient();
  const [selectedText, setSelectedText] = useState<string>("");
  const [popupPos, setPopupPos] = useState<PopupPosition | null>(null);
  const [showTranslatePopup, setShowTranslatePopup] = useState(false);
  const [translatePopupPos, setTranslatePopupPos] = useState<PopupPosition | null>(null);
  const [showAskAIPopup, setShowAskAIPopup] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<
    {
      id: string;
      color: string;
      rects: Array<{ left: number; top: number; width: number; height: number }>;
    }
  >([]);
  const [selectedColor, setSelectedColor] = useState("#FDE68A"); // 默认黄色
  // 笔记弹窗状态：是否显示 & 补充内容
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteExtra, setNoteExtra] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const translatePopupRef = useRef<HTMLDivElement>(null);
  const translatePopupPadding = 10;
  const translatePopupMaxWidth = Math.min(360, window.innerWidth - 2 * translatePopupPadding);
  const translatePopupMaxHeight = 240;
  const isCJK = isCJKEnv();
  const globalViewSettings = settings.globalViewSettings;
  const translateFontFamily = globalViewSettings?.overrideFont
    ? isCJK
      ? globalViewSettings.defaultCJKFont
      : globalViewSettings.defaultFont === "Sans-serif"
        ? globalViewSettings.sansSerifFont
        : globalViewSettings.serifFont
    : undefined;
  const translateTextStyle = {
    fontSize: globalViewSettings?.defaultFontSize ? `${globalViewSettings.defaultFontSize}px` : undefined,
    lineHeight: globalViewSettings?.lineHeight,
    fontFamily: translateFontFamily,
    fontWeight: globalViewSettings?.fontWeight,
    letterSpacing: globalViewSettings?.letterSpacing ? `${globalViewSettings.letterSpacing}px` : undefined,
    wordSpacing: globalViewSettings?.wordSpacing ? `${globalViewSettings.wordSpacing}px` : undefined,
  };

  const {
    content: translateContent,
    status: translateStatus,
    error: translateError,
    translate,
    reset: resetTranslate,
  } = useSelectionTranslate(bookId);

  const title = useMemo(() => file.name || `pdf-${bookId}`, [file.name, bookId]);

  // 初始化 pdf.js 官方 viewer
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        const data = await file.arrayBuffer();
        setLoadError(null);
        const loadingTask = getDocument({ data });
        const pdfDoc = await loadingTask.promise;

        if (!containerRef.current || !viewerRef.current || cancelled) return;

        const eventBus = new EventBus();
        eventBusRef.current = eventBus;
        const linkService = new PDFLinkService({ eventBus });
        const viewer = new PDFViewer({
          container: containerRef.current,
          viewer: viewerRef.current,
          eventBus,
          linkService,
          textLayerMode: 2,
        });
        linkService.setViewer(viewer);

        viewer.setDocument(pdfDoc);
        linkService.setDocument(pdfDoc);
      } catch (e) {
        console.error("Failed to init PDF viewer:", e);
        setLoadError(locale === "en" ? "Failed to load PDF" : "PDF 加载失败");
      }
    };

    setup();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Disable native context menu (double-click/right-click)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      e.preventDefault();
    };
    el.addEventListener("contextmenu", handler);
    return () => {
      el.removeEventListener("contextmenu", handler);
    };
  }, []);

  // 监听选区，定位弹窗
  useEffect(() => {
    const handleSelection = () => {
      if (showAskAIPopup) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPopupPos(null);
        setSelectedText("");
        setShowTranslatePopup(false);
        setTranslatePopupPos(null);
        resetTranslate();
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setPopupPos(null);
        setSelectedText("");
        setShowTranslatePopup(false);
        setTranslatePopupPos(null);
        resetTranslate();
        return;
      }
      if (showTranslatePopup) {
        setShowTranslatePopup(false);
        setTranslatePopupPos(null);
        resetTranslate();
      }
      const range = sel.getRangeAt(0);
      const rects = Array.from(range.getClientRects());
      if (!rects.length) return;
      const union = rects.reduce(
        (acc, r) => ({
          left: Math.min(acc.left, r.left),
          top: Math.min(acc.top, r.top),
          right: Math.max(acc.right, r.right),
          bottom: Math.max(acc.bottom, r.bottom),
        }),
        { left: rects[0]!.left, top: rects[0]!.top, right: rects[0]!.right, bottom: rects[0]!.bottom },
      );
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setSelectedText(text);
      setPopupPos({
        x: union.left - containerRect.left + (union.right - union.left) / 2,
        y: union.top - containerRect.top - 8,
      });
    };

    const handleClickOutside = () => {
      setPopupPos(null);
      setShowAskAIPopup(false);
      setShowTranslatePopup(false);
      setTranslatePopupPos(null);
      resetTranslate();
    };

    document.addEventListener("selectionchange", handleSelection);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAskAIPopup, showTranslatePopup, resetTranslate]);

  // 切换选区时关闭笔记弹窗，避免自动弹出
  useEffect(() => {
    setNoteDialogOpen(false);
    setNoteExtra("");
  }, [selectedText]);

  const handleExplain = () => {
    if (!selectedText) return;
    iframeService.sendExplainTextRequest(selectedText, "explain", bookId);
    setPopupPos(null);
  };

  const handleAskAI = () => {
    if (!selectedText || !popupPos) return;
    setShowAskAIPopup(true);
  };

  const handleHighlight = () => {
    if (!selectedText) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect || rects.length === 0) return;

    const mapped = rects.map((r) => ({
      left: r.left - containerRect.left + containerRef.current!.scrollLeft,
      top: r.top - containerRect.top + containerRef.current!.scrollTop,
      width: r.width,
      height: r.height,
    }));

    const colorMap: Record<string, "red" | "yellow" | "green" | "blue" | "violet"> = {
      "#f87171": "red",
      "#fecaca": "red",
      "#fbbf24": "yellow",
      "#34d399": "green",
      "#60a5fa": "blue",
      "#a78bfa": "violet",
    };
    const normalized = selectedColor.toLowerCase();
    const colorName = colorMap[normalized] ?? "yellow";

    const cfi = `pdf-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    createBookNote({
      bookId,
      type: "annotation",
      cfi,
      style: "highlight",
      color: colorName,
      text: selectedText,
      note: "",
    })
      .then((annotation) => {
        setHighlights((prev) => [...prev, { id: annotation.id, color: selectedColor, rects: mapped }]);
        queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
      })
      .catch(() => {
        // ignore for now
      })
      .finally(() => {
        setPopupPos(null);
        window.getSelection()?.removeAllRanges();
      });
  };

  const handleAddNote = async () => {
    if (!selectedText.trim()) return;
    setNoteDialogOpen(true);
  };

  const handleTranslate = () => {
    if (!selectedText) return;
    const targetLang = resolveTranslateTargetLang(undefined, locale);
    const prompt = t("reader.translateTextPrompt", undefined, { lang: targetLang, text: "" }).trim();
    if (popupPos) {
      setTranslatePopupPos({ x: popupPos.x, y: popupPos.y + 8 });
    }
    setShowTranslatePopup(true);
    translate(selectedText, prompt);
    setPopupPos(null);
    setShowAskAIPopup(false);
  };

  const handleSendAIQuery = (query: string, text: string) => {
    iframeService.sendAskAIRequest(text, query, bookId);
    setShowAskAIPopup(false);
    setPopupPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleCopy = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
    } catch {
      // ignore
    }
    setPopupPos(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fafaf7]">
      <div className="absolute inset-0">
        {loadError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500">{loadError}</div>
        ) : (
          <div
            ref={containerRef}
            className="viewerContainer"
            aria-label={title}
            data-testid="pdf-viewer-container"
            style={{ position: "absolute", inset: 0, overflow: "auto" }}
          >
            <div ref={viewerRef} className="pdfViewer" />
            {highlights.map((h) =>
              h.rects.map((r, idx) => (
                <div
                  key={`${h.id}-${idx}`}
                  className="pointer-events-none absolute rounded-sm"
                  style={{
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height,
                    backgroundColor: h.color,
                    opacity: 0.25,
                  }}
                />
              )),
            )}
          </div>
        )}
      </div>

      {popupPos && !showAskAIPopup && (
        <div
          className="pointer-events-auto absolute z-50 flex items-center rounded-2xl border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          style={{ left: popupPos.x, top: popupPos.y, transform: "translate(-50%, -110%)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <FiCopy size={14} />
            <span>{t("reader.action.copy")}</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleExplain}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <FiHelpCircle size={14} />
            <span>{t("reader.action.explain")}</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleTranslate}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <MdTranslate size={15} />
            <span>{t("reader.action.translate")}</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleAskAI}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <FiMessageCircle size={14} />
            <span>{t("reader.action.askAI")}</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleHighlight}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <PiHighlighterFill size={14} />
            <span>{t("reader.action.highlight")}</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={async () => {
              const target = highlights[highlights.length - 1];
              if (!target) return;
              setHighlights((prev) => prev.slice(0, -1));
              try {
                await deleteBookNote(target.id);
                queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
              } catch {
                // ignore
              }
            }}
            disabled={!highlights.length}
            className="flex items-center gap-1 px-2 py-1 text-red-500 hover:text-red-600 disabled:opacity-50 disabled:hover:text-red-500"
          >
            <RiDeleteBinLine size={14} />
            <span>{t("reader.action.delete")}</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleAddNote}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <NotebookPen size={14} />
            <span>{t("reader.action.note")}</span>
          </button>
        </div>
      )}

      {showAskAIPopup && popupPos && (
        <div
          className="absolute z-50"
          style={{ left: popupPos.x - 160, top: popupPos.y + 12, width: 320 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <AskAIPopup
            style={{ width: "320px" }}
            selectedText={selectedText}
            onClose={() => setShowAskAIPopup(false)}
            onSendQuery={(query) => handleSendAIQuery(query, selectedText)}
          />
        </div>
      )}

      {showTranslatePopup && translatePopupPos && (
        <div
          ref={translatePopupRef}
          className="pointer-events-auto absolute z-50 max-w-[80vw] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          style={{
            left: translatePopupPos.x,
            top: translatePopupPos.y,
            transform:
              translatePopupPos.y - translatePopupMaxHeight - 4 < 0
                ? "translate(-50%, 4px)"
                : "translate(-50%, calc(-100% - 4px))",
            width: "fit-content",
            minWidth: `${Math.min(220, translatePopupMaxWidth)}px`,
            maxWidth: `${translatePopupMaxWidth}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-neutral-500">{t("reader.action.translate")}</div>
          <div
            className="mt-2 overflow-y-auto whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-100"
            style={{ maxHeight: translatePopupMaxHeight - 48, ...translateTextStyle }}
          >
            {translateContent ||
              (translateStatus === "streaming" || translateStatus === "submitted" ? t("chat.loading") : null) ||
              (translateError
                ? translateError instanceof Error
                  ? translateError.message
                  : String(translateError)
                : "")}
          </div>
        </div>
      )}

      {noteDialogOpen && popupPos && (
        <div
          className="pointer-events-auto absolute z-50 w-[340px] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          style={{ left: popupPos.x - 170, top: popupPos.y + 20 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 text-xs text-neutral-500">{t("reader.note.quote")}</div>
          <div className="line-clamp-3 rounded bg-neutral-50 p-2 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            {selectedText}
          </div>
          <div className="mt-3 text-xs text-neutral-500">{t("reader.note.addition")}</div>
          <textarea
            className="mt-1 h-20 w-full resize-none rounded border border-neutral-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder={t("reader.note.placeholder")}
            value={noteExtra}
            onChange={(e) => setNoteExtra(e.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2 text-xs">
            <button
              className="rounded-md px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              onClick={(e) => {
                e.stopPropagation();
                setNoteDialogOpen(false);
                setNoteExtra("");
                setPopupPos(null);
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              className="rounded-md bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-800 dark:bg-primary-500 dark:hover:bg-primary-600 disabled:opacity-50"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const base = selectedText.trim();
                  const extra = noteExtra.trim();
                  const combined = extra ? `${base}\n\n${extra}` : base;
                  const title = combined.length > 50 ? `${combined.slice(0, 50)}...` : combined;
                  const bookMeta = bookData?.book
                    ? { title: bookData.book.title, author: bookData.book.author }
                    : undefined;
                  await handleCreateNote({
                    bookId,
                    bookMeta,
                    title,
                    content: combined,
                  });
                } finally {
                  setNoteDialogOpen(false);
                  setNoteExtra("");
                  setPopupPos(null);
                  setShowAskAIPopup(false);
                  window.getSelection()?.removeAllRanges();
                }
              }}
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
      )}

      {popupPos && !showAskAIPopup && (
        <div
          className="pointer-events-auto absolute z-50 mt-2 flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-2 text-xs text-white shadow-xl"
          style={{ left: popupPos.x, top: popupPos.y, transform: "translate(-50%, 20%)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {[
            "#F87171",
            "#A78BFA",
            "#60A5FA",
            "#34D399",
            "#FBBF24",
            "#FECACA",
          ].map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className="h-5 w-5 rounded-full border border-white/40"
              style={{ backgroundColor: c, boxShadow: selectedColor === c ? "0 0 0 2px #fff" : undefined }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
