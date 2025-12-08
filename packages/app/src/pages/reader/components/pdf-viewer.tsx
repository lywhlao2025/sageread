import { iframeService } from "@/services/iframe-service";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiCopy, FiHelpCircle, FiMessageCircle } from "react-icons/fi";
import { MdTranslate } from "react-icons/md";
import AskAIPopup from "./annotator/ask-ai-popup";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
import { EventBus, PDFLinkService, PDFViewer } from "pdfjs-dist/legacy/web/pdf_viewer";
import "pdfjs-dist/legacy/web/pdf_viewer.css";
// Vite will emit the worker file and give us a URL
// biome-ignore lint/nursery/noImportAssign: asset import
// @ts-ignore
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";

type PopupPosition = { x: number; y: number };

interface PdfViewerProps {
  file: File;
  bookId: string;
}

GlobalWorkerOptions.workerSrc = workerSrc as string;

const PdfViewer: React.FC<PdfViewerProps> = ({ file, bookId }) => {
  const [selectedText, setSelectedText] = useState<string>("");
  const [popupPos, setPopupPos] = useState<PopupPosition | null>(null);
  const [showAskAIPopup, setShowAskAIPopup] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const eventBusRef = useRef<EventBus | null>(null);

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
        setLoadError("PDF 加载失败");
      }
    };

    setup();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // 监听选区，定位弹窗
  useEffect(() => {
    const handleSelection = () => {
      if (showAskAIPopup) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPopupPos(null);
        setSelectedText("");
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setPopupPos(null);
        setSelectedText("");
        return;
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
    };

    document.addEventListener("selectionchange", handleSelection);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAskAIPopup]);

  const handleExplain = () => {
    if (!selectedText) return;
    iframeService.sendExplainTextRequest(selectedText, "explain", bookId);
    setPopupPos(null);
  };

  const handleAskAI = () => {
    if (!selectedText || !popupPos) return;
    setShowAskAIPopup(true);
  };

  const handleTranslate = () => {
    if (!selectedText) return;
    const prompt = `请将下面的英文逐句翻译成地道的中文，保留人名、地名和专有名词的原文，不要解释也不要总结，直接给出译文：\n\n${selectedText}`;
    iframeService.sendAskAIRequest(selectedText, prompt, bookId);
    setPopupPos(null);
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
    <div className="relative h-full w-full overflow-hidden bg-neutral-50">
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
            <span>复制</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleExplain}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <FiHelpCircle size={14} />
            <span>解释</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleTranslate}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <MdTranslate size={15} />
            <span>翻译</span>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            onClick={handleAskAI}
            className="flex items-center gap-1 px-2 py-1 hover:text-primary-600 dark:hover:text-primary-300"
          >
            <FiMessageCircle size={14} />
            <span>询问AI</span>
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
    </div>
  );
};

export default PdfViewer;
