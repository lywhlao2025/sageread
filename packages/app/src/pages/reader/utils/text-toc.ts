import type { TOCItem } from "@/lib/document";

const TEXT_ANCHOR_PREFIX = "txt:line:";
const TEXT_RANGE_PREFIX = "txt:range:";
const MAX_HEADING_LENGTH = 80;

const escapeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const extractHeadingLabel = (line: string): string | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) return null;

  const markdownHeading = trimmed.match(/^#{1,6}\s+(.+)$/);
  if (markdownHeading?.[1]) {
    return escapeWhitespace(markdownHeading[1]);
  }

  const cnChapter = trimmed.match(/^第[一二三四五六七八九十百千万零0-9]+[章节回部篇卷]\s*(.+)?$/);
  if (cnChapter) {
    return escapeWhitespace(trimmed);
  }

  const enChapter = trimmed.match(/^(?:chapter|CHAPTER)\s+([0-9IVXLC]+|[A-Za-z]+)\b\.?\s*(.*)$/);
  if (enChapter) {
    return escapeWhitespace(trimmed);
  }

  return null;
};

export const buildTextAnchor = (line: number) => `${TEXT_ANCHOR_PREFIX}${line}`;

export const parseTextAnchor = (href: string): number | null => {
  if (!href?.startsWith(TEXT_ANCHOR_PREFIX)) return null;
  const raw = href.slice(TEXT_ANCHOR_PREFIX.length);
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
};

export const buildTextRangeCfi = (startLine: number, endLine: number) => {
  const start = Math.max(0, startLine);
  const end = Math.max(start, endLine);
  return `${TEXT_RANGE_PREFIX}${start}:${end}`;
};

export const parseTextRangeCfi = (cfi: string): { start: number; end: number } | null => {
  if (!cfi?.startsWith(TEXT_RANGE_PREFIX)) return null;
  const raw = cfi.slice(TEXT_RANGE_PREFIX.length);
  const [startRaw, endRaw] = raw.split(":");
  const start = Number.parseInt(startRaw ?? "", 10);
  const end = Number.parseInt(endRaw ?? "", 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
};

export const buildTextToc = (textContent?: string | null): TOCItem[] => {
  if (!textContent) return [];
  const lines = textContent.split(/\r?\n/);
  const toc: TOCItem[] = [];

  let id = 0;
  lines.forEach((line, index) => {
    const label = extractHeadingLabel(line);
    if (!label) return;
    toc.push({
      id: id++,
      label,
      href: buildTextAnchor(index),
    });
  });

  return toc;
};
