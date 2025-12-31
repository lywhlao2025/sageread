import { HIGHLIGHT_COLOR_HEX } from "@/services/constants";
import { useAppSettingsStore } from "@/store/app-settings-store";
import type { BookNote } from "@/types/book";
import { useT } from "@/hooks/use-i18n";
import { Overlayer } from "foliate-js/overlayer.js";
import { Languages, NotebookPen } from "lucide-react"; // 引入翻译按钮图标
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { FiCopy, FiHelpCircle, FiMessageCircle } from "react-icons/fi";
import { PiHighlighterFill } from "react-icons/pi";
import { RiDeleteBinLine } from "react-icons/ri";
import { eventDispatcher } from "@/utils/event";
import type { TextSelection } from "@/utils/sel";
import { useAnnotator } from "../../hooks/use-annotator";
import { useFoliateEvents } from "../../hooks/use-foliate-events";
import { useTextSelector } from "../../hooks/use-text-selector";
import { useReaderStore, useReaderStoreApi } from "../reader-provider";
import AnnotationPopup from "./annotation-popup";
import AskAIPopup from "./ask-ai-popup";

const Annotator: React.FC = () => {
  const { settings } = useAppSettingsStore();
  const store = useReaderStoreApi();
  const t = useT();

  const bookId = useReaderStore((state) => state.bookId)!;
  const view = useReaderStore((state) => state.view);
  const isText = useReaderStore((state) => state.bookData?.book?.format === "TXT");
  const globalViewSettings = settings.globalViewSettings;

  // 使用 use-annotator hook
  const {
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
    handleDismissPopup,
    handleCopy,
    handleHighlight,
    addNote,
    handleExplain,
    handleTranslate, // 使用 hook 提供的翻译处理函数
    handleAskAI,
    handleCloseAskAI,
    handleCloseTranslate,
    handleSendAIQuery,
    translateContent,
    translateStatus,
    translateError,
  } = useAnnotator({ bookId });

  const { handleScroll, handleMouseUp, handleShowPopup } = useTextSelector(
    bookId,
    setSelection,
    handleDismissPopup,
    !isText,
  );

  const onLoad = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { doc, index } = detail;

    view?.renderer?.addEventListener("scroll", handleScroll);

    if (detail.doc) {
      detail.doc.addEventListener("mouseup", () => {
        handleMouseUp(doc, index);
      });
    }
  };

  const onDrawAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { draw, annotation, doc, range } = detail;
    const { style, color } = annotation as BookNote;
    const hexColor = color ? HIGHLIGHT_COLOR_HEX[color] : color;
    if (style === "highlight") {
      draw(Overlayer.highlight, { color: hexColor });
    } else if (["underline", "squiggly"].includes(style as string)) {
      const { defaultView } = doc;
      const node = range.startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const { writingMode, lineHeight, fontSize } = defaultView.getComputedStyle(el);
      const lineHeightValue =
        Number.parseFloat(lineHeight) || globalViewSettings?.lineHeight! * globalViewSettings?.defaultFontSize!;
      const fontSizeValue = Number.parseFloat(fontSize) || globalViewSettings?.defaultFontSize;
      const strokeWidth = 2;
      const padding = globalViewSettings?.vertical ? (lineHeightValue - fontSizeValue! - strokeWidth) / 2 : strokeWidth;
      draw(Overlayer[style as keyof typeof Overlayer], { writingMode, color: hexColor, padding });
    }
  };

  const onShowAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { value: cfi, index, range } = detail;
    const currentConfig = store.getState().config;

    const { booknotes = [] } = currentConfig!;
    const annotations = booknotes.filter((booknote) => booknote.type === "annotation" && !booknote.deletedAt);
    const annotation = annotations.find((annotation) => annotation.cfi === cfi);

    if (!annotation) return;

    const newSelection = { key: bookId, annotated: true, text: annotation.text ?? "", range, index };

    setSelectedStyle(annotation.style!);
    setSelectedColor(annotation.color!);
    setSelection(newSelection);
  };

  useFoliateEvents(view, { onLoad, onDrawAnnotation, onShowAnnotation });

  // 同步 popup 显示状态到 text selector
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    handleShowPopup(showAnnotPopup || showAskAIPopup || showTranslatePopup);
  }, [showAnnotPopup, showAskAIPopup, showTranslatePopup]);

  useEffect(() => {
    if (!isText) return;

    const handleTextSelection = (event: CustomEvent) => {
      const detail = event.detail as { bookId?: string; selection?: TextSelection } | undefined;
      if (!detail || detail.bookId !== bookId || !detail.selection) return;
      setSelection(detail.selection);
    };

    const handleClearSelection = (event: CustomEvent) => {
      const detail = event.detail as { bookId?: string } | undefined;
      if (!detail || detail.bookId !== bookId) return;
      handleDismissPopup();
    };

    eventDispatcher.on("text-selection", handleTextSelection);
    eventDispatcher.on("text-selection-clear", handleClearSelection);
    return () => {
      eventDispatcher.off("text-selection", handleTextSelection);
      eventDispatcher.off("text-selection-clear", handleClearSelection);
    };
  }, [bookId, handleDismissPopup, isText, setSelection]);

  const translatePopupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showTranslatePopup) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (translatePopupRef.current && target && translatePopupRef.current.contains(target)) {
        return;
      }
      handleCloseTranslate();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showTranslatePopup, handleCloseTranslate]);

  const selectionAnnotated = selection?.annotated;
  // 笔记弹窗状态（补充内容 + 显示）
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteExtra, setNoteExtra] = useState("");

  // 切换选区时关闭笔记弹窗，避免自动弹出
  useEffect(() => {
    setNoteDialogOpen(false);
    setNoteExtra("");
  }, [selection?.key, selection?.text]);
  const buttons = [
    { label: t("reader.action.copy"), Icon: FiCopy, onClick: handleCopy },
    { label: t("reader.action.explain"), Icon: FiHelpCircle, onClick: handleExplain },
    { label: t("reader.action.translate"), Icon: Languages, onClick: handleTranslate }, // 新增翻译按钮
    { label: t("reader.action.askAI"), Icon: FiMessageCircle, onClick: handleAskAI },
    {
      label: undefined,
      Icon: selectionAnnotated ? RiDeleteBinLine : PiHighlighterFill,
      onClick: handleHighlight,
    },
    {
      label: undefined,
      Icon: NotebookPen,
      onClick: () => {
        setNoteDialogOpen(true);
      },
    },
  ];

  return (
    <div>
      {showAnnotPopup && !showAskAIPopup && trianglePosition && annotPopupPosition && (
        <AnnotationPopup
          dir={globalViewSettings?.rtl ? "rtl" : "ltr"}
          isVertical={globalViewSettings?.vertical ?? false}
          buttons={buttons}
          position={annotPopupPosition}
          trianglePosition={trianglePosition}
          highlightOptionsVisible={highlightOptionsVisible}
          selectedStyle={selectedStyle}
          selectedColor={selectedColor}
          popupWidth={annotPopupWidth}
          popupHeight={annotPopupHeight}
          onHighlight={handleHighlight}
        />
      )}
      {showAskAIPopup && askAIPopupPosition && selection && (
        <AskAIPopup
          style={{
            left: `${askAIPopupPosition.point.x}px`,
            top: `${askAIPopupPosition.point.y + 15}px`,
            width: "320px",
          }}
          selectedText={selection.text}
          onClose={handleCloseAskAI}
          onSendQuery={handleSendAIQuery}
        />
      )}

      {showTranslatePopup && translatePopupPosition && (
        <div
          ref={translatePopupRef}
          className="pointer-events-auto absolute z-50 w-[360px] max-w-[80vw] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          style={{
            left: `${translatePopupPosition.point.x}px`,
            top: `${translatePopupPosition.point.y}px`,
            width: `${translatePopupWidth}px`,
            height: `${translatePopupHeight}px`,
            transform:
              translatePopupPosition.point.y - translatePopupHeight - 4 < 0
                ? "translate(-50%, 4px)"
                : "translate(-50%, calc(-100% - 4px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-neutral-500">{t("reader.action.translate")}</div>
          <div
            className="mt-2 overflow-y-auto whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-100"
            style={{ maxHeight: translatePopupHeight - 32 }}
          >
            {translateContent ||
              (translateStatus === "streaming" || translateStatus === "submitted" ? t("chat.loading") : null) ||
              (translateError ? "Translation failed." : "")}
          </div>
        </div>
      )}

      {noteDialogOpen && selection && annotPopupPosition && (
        <div
          className="pointer-events-auto absolute z-50 w-[340px] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          style={{
            left: annotPopupPosition.point.x - 170,
            top: annotPopupPosition.point.y + 20,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 text-xs text-neutral-500">{t("reader.note.quote")}</div>
          <div className="line-clamp-3 rounded bg-neutral-50 p-2 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            {selection.text}
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
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              className="rounded-md bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-800 dark:bg-primary-500 dark:hover:bg-primary-600 disabled:opacity-50"
              onClick={async (e) => {
                e.stopPropagation();
                await addNote(noteExtra);
                setNoteDialogOpen(false);
                setNoteExtra("");
                handleDismissPopup();
              }}
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Annotator;
