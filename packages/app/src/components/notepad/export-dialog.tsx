import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBookNotes } from "@/services/book-note-service";
import { getNotesPaginated } from "@/services/note-service";
import type { BookNote } from "@/types/book";
import type { Note } from "@/types/note";
import { save } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { marked } from "marked";
import { appDataDir, join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ExportContent = "notes" | "annotations" | "both";
type ExportFormat = "markdown" | "pdf";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle?: string;
  bookAuthor?: string;
}

const sanitizeFileName = (name: string) => name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_").trim();

const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const buildMarkdown = (opts: {
  bookTitle?: string;
  bookAuthor?: string;
  exportedAt: number;
  notes: Note[];
  annotations: BookNote[];
  content: ExportContent;
}) => {
  const quoteBlock = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return "";
    return trimmed
      .split("\n")
      .map((line) => `> ${line}`.trimEnd())
      .join("\n");
  };

  const boldText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return "";
    // Bold multi-paragraph content safely: wrap each paragraph individually.
    const paragraphs = trimmed
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `**${p.replace(/\*\*/g, "")}**`);
    return paragraphs.join("\n\n");
  };

  const title = opts.bookTitle?.trim() || "Untitled";
  const author = opts.bookAuthor?.trim();
  const lines: string[] = [];

  lines.push(`# ${title} - 导出`);
  if (author) lines.push(`- 作者：${author}`);
  lines.push(`- 导出时间：${new Date(opts.exportedAt).toLocaleString()}`);
  lines.push("");

  if (opts.content === "notes" || opts.content === "both") {
    lines.push("## 笔记");
    if (!opts.notes.length) {
      lines.push("_无_");
    } else {
      for (const [i, note] of opts.notes.entries()) {
        if (i > 0) {
          lines.push("");
          lines.push("---");
          lines.push("");
          lines.push("");
        }
        const contentRaw = (note.content || "").trim();
        if (!contentRaw) {
          lines.push(boldText("无内容"));
        } else {
          // Notes created from selections often contain: quoted book text + user comment.
          // Heuristic: first block (before blank line) is book quote, the rest is user's writing.
          const [firstBlock, ...restBlocks] = contentRaw.split(/\n{2,}/);
          const rest = restBlocks.join("\n\n").trim();
          lines.push(quoteBlock(firstBlock));
          if (rest) {
            lines.push("");
            lines.push(boldText(rest));
          }
        }
        lines.push("");
      }
    }
    lines.push("");
  }

  if (opts.content === "annotations" || opts.content === "both") {
    lines.push("## 标注");
    if (!opts.annotations.length) {
      lines.push("_无_");
    } else {
      for (const [i, ann] of opts.annotations.entries()) {
        if (i > 0) {
          lines.push("");
          lines.push("---");
          lines.push("");
          lines.push("");
        }
        if (ann.text?.trim()) lines.push(quoteBlock(ann.text));
        if (ann.note?.trim()) {
          lines.push("");
          lines.push(boldText(ann.note));
        }
        if (ann.context?.before || ann.context?.after) {
          lines.push("");
          const before = (ann.context?.before || "").trim();
          const after = (ann.context?.after || "").trim();
          if (before || after) lines.push(`- 上下文：…${before} **[标注]** ${after}…`);
        }
        lines.push("");
      }
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
};

const getAllNotes = async (bookId: string) => {
  const all: Note[] = [];
  let page = 1;
  const pageSize = 50;
  // Hard cap to avoid infinite loops if backend misbehaves.
  const maxPages = 200;
  while (page <= maxPages) {
    const batch = await getNotesPaginated(page, pageSize, { bookId });
    all.push(...batch);
    if (batch.length < pageSize) break;
    page += 1;
  }
  return all.sort((a, b) => a.createdAt - b.createdAt);
};

const getAllAnnotations = async (bookId: string) => {
  const bookNotes = await getBookNotes(bookId);
  return bookNotes
    .filter((n) => n.type === "annotation" && !n.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt);
};

export const ExportDialog = ({ open, onOpenChange, bookId, bookTitle, bookAuthor }: ExportDialogProps) => {
  const [content, setContent] = useState<ExportContent>("notes");
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [isExporting, setIsExporting] = useState(false);

  const defaultBaseName = useMemo(() => {
    const base = sanitizeFileName(bookTitle?.trim() || "book");
    return `${base}-export-${formatDateTime(Date.now())}`;
  }, [bookTitle]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const [notes, annotations] = await Promise.all([
        content === "annotations" ? Promise.resolve([]) : getAllNotes(bookId),
        content === "notes" ? Promise.resolve([]) : getAllAnnotations(bookId),
      ]);

      const markdown = buildMarkdown({
        bookTitle,
        bookAuthor,
        exportedAt: Date.now(),
        notes,
        annotations,
        content,
      });

      if (format === "markdown") {
        const path = await save({
          defaultPath: `${defaultBaseName}.md`,
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (!path) return;
        await writeTextFile(path, markdown);
        toast.success("已导出 Markdown");
        onOpenChange(false);
        return;
      }

      // PDF: use system print-to-pdf for reliability (no extra deps).
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${(bookTitle || "Export").replace(/</g, "&lt;")}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"; padding: 24px; line-height: 1.6; }
    h1,h2,h3 { margin: 0.8em 0 0.4em; }
    blockquote { margin: 0.8em 0; padding: 0.2em 0.8em; border-left: 3px solid #ddd; color: #444; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    hr { border: 0; border-top: 1px solid #eee; margin: 16px 0; }
  </style>
</head>
<body>
${marked.parse(markdown)}
<script>
  // Best-effort auto print in browsers.
  window.addEventListener('load', () => setTimeout(() => window.print(), 250), { once: true });
</script>
</body>
</html>`;

      // Tauri WebView printing can be unreliable; open in default browser and let the user "Save as PDF".
      // Must store the file under APPDATA because opener is scoped by capabilities.
      const baseDir = await appDataDir();
      const exportDir = await join(baseDir, "exports");
      if (!(await exists(exportDir))) await mkdir(exportDir, { recursive: true });

      const fileName = `${defaultBaseName}.html`;
      const filePath = await join(exportDir, fileName);
      await writeTextFile(filePath, html);
      await openPath(filePath);
      toast.message("已在浏览器打开导出内容，请在系统打印对话框中选择“存储为 PDF”");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("导出失败");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader>
          <DialogTitle>导出</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <Label>导出内容</Label>
            <Select value={content} onValueChange={(v) => setContent(v as ExportContent)}>
              <SelectTrigger>
                <SelectValue placeholder="选择导出内容" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notes">笔记</SelectItem>
                <SelectItem value="annotations">标注</SelectItem>
                <SelectItem value="both">笔记 & 标注</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>导出格式</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue placeholder="选择导出格式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isExporting}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "导出中…" : "导出"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
