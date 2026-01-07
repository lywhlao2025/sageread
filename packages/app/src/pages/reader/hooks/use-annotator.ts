import { useNotepad } from "@/components/notepad/hooks";
import { createBookNote, deleteBookNote, updateBookNote } from "@/services/book-note-service";
import { createOrUpdatePublicHighlight, getPublicHighlightsDeviceId } from "@/services/public-highlights-service";
import { iframeService } from "@/services/iframe-service";
import { useAppSettingsStore } from "@/store/app-settings-store";
import type { BookNote, HighlightColor, HighlightStyle } from "@/types/book";
import type { BookMeta } from "@/types/note";
import { type Position, type TextSelection, getPopupPosition, getPosition } from "@/utils/sel";
import { getTargetLang } from "@/utils/misc"; // 获取环境默认的翻译目标语言
import { useLocale, useT } from "@/hooks/use-i18n";
import { useQueryClient } from "@tanstack/react-query";
import * as CFI from "foliate-js/epubcfi.js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useReaderStore, useReaderStoreApi } from "../components/reader-provider";
import { buildTextRangeCfi } from "../utils/text-toc";
import { useSelectionTranslate } from "./use-selection-translate";

function getContextByRange(range: Range, win = 30) {
  const container = range.commonAncestorContainer;
  const el =
    (container.nodeType === Node.ELEMENT_NODE ? (container as Element) : (container.parentElement as Element)).closest(
      "p,li,div,section,article,blockquote,td",
    ) || document.body;

  const blockText = el.textContent || "";
  const highlight = range.toString();
  const i = blockText.indexOf(highlight);
  if (i < 0) return { before: "", highlight, after: "" };

  const s = Math.max(0, i - win);
  const e = Math.min(blockText.length, i + highlight.length + win);
  const squash = (s: string) => s.replace(/\s+/g, " ");
  return {
    before: squash(blockText.slice(s, i)),
    highlight,
    after: squash(blockText.slice(i + highlight.length, e)),
  };
}

const getRangeTextOffset = (root: Node, container: Node, offset: number) => {
  if (root !== container && "contains" in root && !(root as Node).contains(container)) return null;
  const doc = container.ownerDocument ?? (root as Document);
  if (!doc?.createRange) return null;
  const probe = doc.createRange();
  probe.selectNodeContents(root);
  probe.setEnd(container, offset);
  return probe.toString().length;
};

interface UseAnnotatorProps {
  bookId: string;
}

export const useAnnotator = ({ bookId }: UseAnnotatorProps) => {
  const t = useT();
  const locale = useLocale();
  const { settings } = useAppSettingsStore();
  const config = useReaderStore((state) => state.config)!;
  const progress = useReaderStore((state) => state.progress)!;
  const view = useReaderStore((state) => state.view);
  const bookData = useReaderStore((state) => state.bookData);
  const store = useReaderStoreApi();
  const { handleCreateNote } = useNotepad();
  const queryClient = useQueryClient();
  const globalViewSettings = settings.globalViewSettings;

  // 状态管理
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [showAnnotPopup, setShowAnnotPopup] = useState(false);
  const [showAskAIPopup, setShowAskAIPopup] = useState(false);
  const [showTranslatePopup, setShowTranslatePopup] = useState(false);
  const [trianglePosition, setTrianglePosition] = useState<Position>();
  const [annotPopupPosition, setAnnotPopupPosition] = useState<Position>();
  const [askAIPopupPosition, setAskAIPopupPosition] = useState<Position>();
  const [translatePopupPosition, setTranslatePopupPosition] = useState<Position>();
  const [highlightOptionsVisible, setHighlightOptionsVisible] = useState(false);

  const [selectedStyle, setSelectedStyle] = useState<HighlightStyle>(settings.globalReadSettings.highlightStyle);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(
    settings.globalReadSettings.highlightStyles[selectedStyle],
  );

  const popupPadding = 10;
  const annotPopupWidth = Math.min(globalViewSettings?.vertical ? 320 : 390, window.innerWidth - 2 * popupPadding);
  const annotPopupHeight = 36;
  const translatePopupWidth = Math.min(360, window.innerWidth - 2 * popupPadding);
  const translatePopupHeight = 220;
  const isText = bookData?.book?.format === "TXT";
  const isPdf = bookData?.book?.format === "PDF";

  const getEpubSectionInfo = useCallback(
    (range: Range, index: number) => {
      const rootNode = range.startContainer?.getRootNode();
      const root =
        rootNode instanceof Document
          ? rootNode.body ?? rootNode.documentElement ?? rootNode
          : rootNode ?? range.startContainer.ownerDocument?.body ?? range.startContainer.ownerDocument?.documentElement;
      if (!root) return null;
      const startOffset = getRangeTextOffset(root, range.startContainer, range.startOffset);
      const endOffset = getRangeTextOffset(root, range.endContainer, range.endOffset);
      if (startOffset == null || endOffset == null) return null;
      const sectionId = view?.book?.sections?.[index]?.id ?? bookData?.bookDoc?.sections?.[index]?.id;
      if (!sectionId) return null;
      const normStart = Math.min(startOffset, endOffset);
      const normEnd = Math.max(startOffset, endOffset);
      return { sectionId, normStart, normEnd };
    },
    [bookData?.bookDoc?.sections, view?.book?.sections],
  );

  const uploadPublicHighlight = useCallback(
    async (annotation: BookNote, selectionInfo: TextSelection) => {
      if (isPdf) {
        return;
      }
      const anchorType = isText ? "txt" : "epub";
      const deviceId = await getPublicHighlightsDeviceId();
      const payloadBase = {
        deviceId,
        bookKey: bookId,
        anchorType,
        anchor: annotation.cfi,
        quote: annotation.text || selectionInfo.text,
        style: annotation.style,
        color: annotation.color,
      } as const;

      if (anchorType === "epub") {
        const sectionInfo =
          annotation.sectionId && annotation.normStart != null && annotation.normEnd != null
            ? {
                sectionId: annotation.sectionId,
                normStart: annotation.normStart,
                normEnd: annotation.normEnd,
              }
            : getEpubSectionInfo(selectionInfo.range, selectionInfo.index);
        if (!sectionInfo) {
          console.warn("Skipping public highlight upload: missing EPUB section info.");
          return;
        }
        await createOrUpdatePublicHighlight({
          ...payloadBase,
          sectionId: sectionInfo.sectionId,
          normStart: sectionInfo.normStart,
          normEnd: sectionInfo.normEnd,
        });
        return;
      }

      await createOrUpdatePublicHighlight({
        ...payloadBase,
        sectionId: null,
        normStart: null,
        normEnd: null,
      });
    },
    [bookId, getEpubSectionInfo, isPdf, isText],
  );

  const getTextRangeFromSelection = (range: Range): { start: number; end: number } | null => {
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    const startElement = startNode.nodeType === Node.ELEMENT_NODE ? (startNode as Element) : startNode.parentElement;
    const endElement = endNode.nodeType === Node.ELEMENT_NODE ? (endNode as Element) : endNode.parentElement;
    const startLine = startElement?.closest("[data-line]")?.getAttribute("data-line");
    const endLine = endElement?.closest("[data-line]")?.getAttribute("data-line");
    const start = startLine ? Number.parseInt(startLine, 10) : Number.NaN;
    const end = endLine ? Number.parseInt(endLine, 10) : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  };

  const {
    content: translateContent,
    status: translateStatus,
    error: translateError,
    translate,
    reset: resetTranslate,
  } = useSelectionTranslate(bookId);

  // Popup 相关函数
  const handleDismissPopup = useCallback(() => {
    setSelection(null);
    setShowAnnotPopup(false);
    setShowAskAIPopup(false);
    setShowTranslatePopup(false);
    setTranslatePopupPosition(undefined);
    resetTranslate();
  }, [resetTranslate]);

  const handleDismissPopupAndSelection = useCallback(() => {
    handleDismissPopup();
    view?.deselect();
  }, [handleDismissPopup, view]);

  // 业务逻辑函数
  const handleCopy = useCallback(() => {
    if (!selection || !selection.text) return;
    if (selection) navigator.clipboard?.writeText(selection.text);
    toast.success("Copy success!");
    handleDismissPopupAndSelection();
  }, [selection, handleDismissPopupAndSelection]);

  const handleHighlight = useCallback(
    async (update = false) => {
      if (!selection || !selection.text) return;
      setHighlightOptionsVisible(true);
      const { booknotes: annotations = [] } = config;
      const cfi = isText
        ? (() => {
            const range = getTextRangeFromSelection(selection.range);
            return range ? buildTextRangeCfi(range.start, range.end) : null;
          })()
        : view?.getCFI(selection.index, selection.range);
      if (!cfi) return;
      const sectionInfo = !isText && !isPdf ? getEpubSectionInfo(selection.range, selection.index) : null;

      const style = settings.globalReadSettings.highlightStyle;
      const color = settings.globalReadSettings.highlightStyles[style];

      const existingAnnotation = annotations.find(
        (annotation) => annotation.cfi === cfi && annotation.type === "annotation" && !annotation.deletedAt,
      );

      try {
        if (existingAnnotation) {
          if (update) {
            const updatedAnnotation = await updateBookNote(existingAnnotation.id, {
              style,
              color,
              text: selection.text,
              note: existingAnnotation.note,
              sectionId: sectionInfo?.sectionId,
              normStart: sectionInfo?.normStart,
              normEnd: sectionInfo?.normEnd,
            });

            const updatedAnnotations = annotations.map((ann) =>
              ann.id === existingAnnotation.id ? updatedAnnotation : ann,
            );
            const updatedConfig = store.getState().updateBooknotes(updatedAnnotations);
            if (!isText) {
              view?.addAnnotation(updatedAnnotation, true);
              view?.addAnnotation(updatedAnnotation);
            }

            if (updatedConfig) {
              await store.getState().saveConfig(updatedConfig);
            }
            queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
            void uploadPublicHighlight(updatedAnnotation, selection).catch((error) => {
              console.warn("Failed to upload public highlight:", error);
            });
          } else {
            await deleteBookNote(existingAnnotation.id);
            const updatedAnnotations = annotations.filter((ann) => ann.id !== existingAnnotation.id);
            const updatedConfig = store.getState().updateBooknotes(updatedAnnotations);
            if (!isText) {
              view?.addAnnotation(existingAnnotation, true);
            }

            setShowAnnotPopup(false);

            if (updatedConfig) {
              await store.getState().saveConfig(updatedConfig);
            }

            queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
          }
        } else {
          const ctx = getContextByRange(selection.range, 50);
          const newAnnotation = await createBookNote({
            bookId,
            type: "annotation",
            cfi,
            style,
            color,
            text: selection.text,
            note: "",
            sectionId: sectionInfo?.sectionId,
            normStart: sectionInfo?.normStart,
            normEnd: sectionInfo?.normEnd,
            context: {
              before: ctx.before,
              after: ctx.after,
            },
          });

          const updatedAnnotations = [...annotations, newAnnotation];
          const updatedConfig = store.getState().updateBooknotes(updatedAnnotations);
          if (!isText) {
            view?.addAnnotation(newAnnotation);
          }
          setSelection({ ...selection, annotated: true });

          if (updatedConfig) {
            await store.getState().saveConfig(updatedConfig);
          }

          queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
          void uploadPublicHighlight(newAnnotation, selection).catch((error) => {
            console.warn("Failed to upload public highlight:", error);
          });
        }
      } catch (error) {
        console.error("Failed to handle highlight:", error);
        toast.error("Failed to save annotation");
      }
    },
    [selection, config, view, settings, bookId, store, queryClient, isText, isPdf, getEpubSectionInfo, uploadPublicHighlight],
  );

  const addNote = useCallback(
    async (extraContent = "") => {
    if (!selection || !selection.text) return;

    try {
        const base = selection.text.trim();
        const combined = extraContent.trim() ? `${base}\n\n${extraContent.trim()}` : base;
        const title = combined.length > 50 ? `${combined.substring(0, 50)}...` : combined;

      if (!bookData?.book) {
        toast.error("无法获取书籍信息");
        return;
      }

      const bookMeta: BookMeta = {
        title: bookData.book.title,
        author: bookData.book.author,
      };

      await handleCreateNote({
        bookId,
        bookMeta,
        title,
        content: combined,
      });
      toast.success("笔记已创建");
    } catch (error) {
      toast.error("创建笔记失败");
    }
    },
    [selection, bookData, bookId, handleCreateNote],
  );

  const handleExplain = useCallback(() => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    iframeService.sendExplainTextRequest(selection.text, "explain", bookId);
  }, [selection, bookId]);

  const handleTranslate = useCallback(() => { // 处理翻译请求
    if (!selection || !selection.text) return; // 无选中内容时退出
    const configuredLang = settings.globalReadSettings.translateTargetLang?.trim(); // 获取用户配置的目标语言
    // Older defaults used "EN" which makes the prompt unnatural for many models.
    // Prefer translating to Chinese unless user explicitly configured a different target language.
    const normalized = (configuredLang || "").trim();
    const normalizedLower = normalized.toLowerCase();
    const targetLang =
      !normalized
        ? getTargetLang()
        : normalized === "EN" || normalizedLower === "en" || normalizedLower === "english"
          ? locale === "en"
            ? "English"
            : "中文"
          : normalizedLower.startsWith("zh")
            ? "中文"
            : normalized;
    const question = `${t("reader.translateQuoted", "请将引用内容翻译成{lang}。", {
      lang: targetLang,
      text: selection.text,
    })}\n\n${t(
      "reader.translateDirectives",
      "Answer the question directly.\nDo not include analysis, reasoning, thoughts, or explanations.\nOnly output the final result.",
    )}`; // 构造翻译提问

    const gridFrame = document.querySelector(`#gridcell-${bookId}`);
    if (!gridFrame) return;
    const rect = gridFrame.getBoundingClientRect();
    const triangPos = getPosition(selection.range, rect, popupPadding, globalViewSettings?.vertical);
    const translatePopupAnchor = globalViewSettings?.vertical
      ? triangPos
      : ({
          point: {
            x: triangPos.point.x,
            y: triangPos.point.y + 12,
          },
          dir: "up",
        } as Position);
    const translatePopupPos = getPopupPosition(
      translatePopupAnchor,
      rect,
      globalViewSettings?.vertical ? translatePopupHeight : translatePopupWidth,
      globalViewSettings?.vertical ? translatePopupWidth : 0,
      popupPadding,
    );

    if (triangPos.point.x === 0 || triangPos.point.y === 0) return;

    setShowAnnotPopup(false);
    setShowAskAIPopup(false);
    setTranslatePopupPosition(translatePopupPos);
    setShowTranslatePopup(true);
    translate(selection.text, question);
  }, [
    selection,
    settings.globalReadSettings.translateTargetLang,
    bookId,
    locale,
    t,
    globalViewSettings?.vertical,
    translate,
    popupPadding,
    translatePopupHeight,
    translatePopupWidth,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handleAskAI = useCallback(() => {
    if (!selection || !selection.text) return;

    setShowAnnotPopup(false);
    setShowAskAIPopup(false);

    // Calculate position for AskAI popup
    const gridFrame = document.querySelector(`#gridcell-${bookId}`);
    if (!gridFrame) return;
    const rect = gridFrame.getBoundingClientRect();
    const triangPos = getPosition(selection.range, rect, popupPadding, globalViewSettings?.vertical);

    // Calculate AskAI popup position
    const askAIPopupWidth = 320;
    const askAIPopupHeight = 120;
    const askAIPopupPos = getPopupPosition(
      triangPos,
      rect,
      globalViewSettings?.vertical ? askAIPopupHeight : askAIPopupWidth,
      globalViewSettings?.vertical ? askAIPopupWidth : askAIPopupHeight,
      popupPadding,
    );

    if (triangPos.point.x === 0 || triangPos.point.y === 0) return;
    setAskAIPopupPosition(askAIPopupPos);

    setTimeout(() => {
      setShowAskAIPopup(true);
    }, 0);
  }, [selection, bookId, globalViewSettings, popupPadding]);

  const handleCloseAskAI = useCallback(() => {
    setShowAskAIPopup(false);
    view?.deselect();
  }, [view]);

  const handleCloseTranslate = useCallback(() => {
    setShowTranslatePopup(false);
    setTranslatePopupPosition(undefined);
    resetTranslate();
    view?.deselect();
  }, [resetTranslate, view]);

  const handleSendAIQuery = useCallback(
    (query: string, selectedText: string) => {
      iframeService.sendAskAIRequest(selectedText, query, bookId);
      handleDismissPopupAndSelection();
    },
    [handleDismissPopupAndSelection, bookId],
  );

  // Popup 位置计算
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    setHighlightOptionsVisible(!!selection?.annotated);
    if (selection && selection.text.trim().length > 0 && !showAskAIPopup && !showTranslatePopup) {
      const gridFrame = document.querySelector(`#gridcell-${bookId}`);

      if (!gridFrame) {
        return;
      }

      const rect = gridFrame.getBoundingClientRect();
      const triangPos = getPosition(selection.range, rect, popupPadding, globalViewSettings?.vertical);
      const annotPopupPos = getPopupPosition(
        triangPos,
        rect,
        globalViewSettings?.vertical ? annotPopupHeight : annotPopupWidth,
        globalViewSettings?.vertical ? annotPopupWidth : annotPopupHeight,
        popupPadding,
      );

      if (triangPos.point.x === 0 || triangPos.point.y === 0) {
        return;
      }

      setAnnotPopupPosition(annotPopupPos);
      setTrianglePosition(triangPos);
      setShowAnnotPopup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, bookId, showAskAIPopup, showTranslatePopup]);

  // 加载当前页面的标注
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!progress || isText) return;
    const { location } = progress;
    const start = CFI.collapse(location);
    const end = CFI.collapse(location, true);
    const { booknotes = [] } = config;
    const annotations = booknotes.filter(
      (item) =>
        !item.deletedAt &&
        item.type === "annotation" &&
        item.style &&
        CFI.compare(item.cfi, start) >= 0 &&
        CFI.compare(item.cfi, end) <= 0,
    );
    try {
      Promise.all(annotations.map((annotation) => view?.addAnnotation(annotation)));
    } catch (e) {
      console.warn(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, isText]);

  return {
    // 状态
    selection,
    setSelection,
    showAnnotPopup,
    showAskAIPopup,
    showTranslatePopup,
    trianglePosition,
    annotPopupPosition,
    askAIPopupPosition,
    translatePopupPosition,
    highlightOptionsVisible,
    selectedStyle,
    setSelectedStyle,
    selectedColor,
    setSelectedColor,
    annotPopupWidth,
    annotPopupHeight,
    translatePopupWidth,
    translatePopupHeight,

    // 函数
    handleDismissPopup,
    handleDismissPopupAndSelection,
    handleCopy,
    handleHighlight,
    addNote,
    handleExplain,
    handleTranslate, // 暴露翻译按钮对应的处理函数
    handleAskAI,
    handleCloseAskAI,
    handleCloseTranslate,
    handleSendAIQuery,
    translateContent,
    translateStatus,
    translateError,
  };
};
