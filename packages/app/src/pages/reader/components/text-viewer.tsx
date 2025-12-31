import { useEffect, useMemo, useRef, useState } from "react";
import { eventDispatcher } from "@/utils/event";
import { cn } from "@/lib/utils";
import { getTextFromRange, type TextSelection } from "@/utils/sel";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { isCJKEnv } from "@/utils/misc";
import { useReaderStore } from "./reader-provider";
import { HIGHLIGHT_COLOR_HEX, HIGHLIGHT_COLOR_RGBA } from "@/services/constants";
import type { HighlightStyle, HighlightColor, BookNote } from "@/types/book";
import { parseTextRangeCfi } from "../utils/text-toc";

interface TextViewerProps {
  bookId: string;
  textContent: string | null | undefined;
}

const TextViewer = ({ bookId, textContent }: TextViewerProps) => {
  const [loadError, setLoadError] = useState(false);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hadTextSelection = useRef(false);
  const { settings } = useAppSettingsStore();
  const globalViewSettings = settings.globalViewSettings;
  const booknotes = useReaderStore((state) => state.config?.booknotes ?? []);

  const lines = useMemo(() => (textContent ? textContent.split(/\r?\n/) : []), [textContent]);

  useEffect(() => {
    setLoadError(textContent == null);
  }, [textContent]);

  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      const detail = event.detail as { bookId?: string; line?: number } | undefined;
      if (!detail || detail.bookId !== bookId) return;
      if (typeof detail.line !== "number") return;
      const target = lineRefs.current[detail.line];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightLine(detail.line);
      }
    };

    eventDispatcher.on("text-navigate", handleNavigate);
    return () => {
      eventDispatcher.off("text-navigate", handleNavigate);
    };
  }, [bookId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const clearSelection = () => {
      hadTextSelection.current = false;
      eventDispatcher.dispatch("text-selection-clear", { bookId });
    };

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        clearSelection();
        return;
      }
      const text = selection.toString();
      if (!text.trim()) {
        clearSelection();
        return;
      }
      const range = selection.getRangeAt(0);
      const commonNode = range.commonAncestorContainer;
      const commonElement = commonNode.nodeType === Node.ELEMENT_NODE ? commonNode : commonNode.parentElement;
      if (!commonElement || !container.contains(commonElement)) {
        clearSelection();
        return;
      }
      const content = getTextFromRange(range).trim();
      if (!content) {
        clearSelection();
        return;
      }
      const selectionObject: TextSelection = {
        key: bookId,
        text: content,
        range,
        index: 0,
      };
      hadTextSelection.current = true;
      eventDispatcher.dispatch("text-selection", { bookId, selection: selectionObject });
    };

    const handleScroll = () => {
      clearSelection();
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        if (hadTextSelection.current) {
          clearSelection();
        }
        return;
      }

      const range = selection.getRangeAt(0);
      const commonNode = range.commonAncestorContainer;
      const commonElement = commonNode.nodeType === Node.ELEMENT_NODE ? commonNode : commonNode.parentElement;
      if (!commonElement || !container.contains(commonElement)) {
        if (hadTextSelection.current) {
          clearSelection();
        }
        return;
      }

      if (!selection.toString().trim()) {
        if (hadTextSelection.current) {
          clearSelection();
        }
      }
    };

    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("scroll", handleScroll);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("scroll", handleScroll);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [bookId]);

  useEffect(() => {
    if (highlightLine === null) return;
    const timeout = window.setTimeout(() => setHighlightLine(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [highlightLine]);

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
        无法读取文本内容
      </div>
    );
  }

  const isCJK = isCJKEnv();
  const fontFamily = globalViewSettings.overrideFont
    ? isCJK
      ? globalViewSettings.defaultCJKFont
      : globalViewSettings.defaultFont === "Sans-serif"
        ? globalViewSettings.sansSerifFont
        : globalViewSettings.serifFont
    : undefined;

  const textAnnotations = useMemo(() => {
    return booknotes.filter((note) => note.type === "annotation" && !note.deletedAt && note.cfi?.startsWith("txt:"));
  }, [booknotes]);

  const lineHighlights = useMemo(() => {
    const map = new Map<number, { style: HighlightStyle; color: HighlightColor }>();
    for (const note of textAnnotations) {
      const range = parseTextRangeCfi(note.cfi);
      if (!range) continue;
      for (let line = range.start; line <= range.end; line += 1) {
        if (!map.has(line)) {
          map.set(line, {
            style: note.style || "highlight",
            color: note.color || "yellow",
          });
        }
      }
    }
    return map;
  }, [textAnnotations]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto px-6 py-4 text-neutral-800 dark:text-neutral-100"
      style={{
        fontSize: `${globalViewSettings.defaultFontSize}px`,
        lineHeight: globalViewSettings.lineHeight,
        fontFamily,
        fontWeight: globalViewSettings.fontWeight,
        letterSpacing: globalViewSettings.letterSpacing ? `${globalViewSettings.letterSpacing}px` : undefined,
        wordSpacing: globalViewSettings.wordSpacing ? `${globalViewSettings.wordSpacing}px` : undefined,
      }}
    >
      <div>
        {lines.map((line, index) => (
          (() => {
            const highlight = lineHighlights.get(index);
            const bgColor = highlight ? HIGHLIGHT_COLOR_RGBA[highlight.color] : undefined;
            const lineColor = highlight ? HIGHLIGHT_COLOR_HEX[highlight.color] : undefined;
            const textDecoration =
              highlight && highlight.style !== "highlight"
                ? highlight.style === "squiggly"
                  ? "underline wavy"
                  : "underline"
                : undefined;
            return (
          <div
            key={`line-${index}`}
            data-line={index}
            ref={(element) => {
              lineRefs.current[index] = element;
            }}
            className={cn(
              "whitespace-pre-wrap",
              highlightLine === index && "rounded bg-emerald-100/70 dark:bg-emerald-900/40",
            )}
            style={{
              backgroundColor: highlight?.style === "highlight" ? bgColor : undefined,
              textDecoration,
              textDecorationColor: lineColor,
              textDecorationThickness: highlight && highlight.style !== "highlight" ? "2px" : undefined,
            }}
          >
            {line || "\u00A0"}
          </div>
            );
          })()
        ))}
      </div>
    </div>
  );
};

export default TextViewer;
