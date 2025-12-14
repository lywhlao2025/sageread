export function parseAnnotations(text: string): (string | { type: "annotation"; number: string })[] {
  // Only treat numeric citations like "[123]" as chunk annotations.
  // Also strip placeholder "[chunk_id]" which some models may output literally.
  const sanitized = text.replace(/\[\s*chunk[\s_]?id\s*\]/gi, "");
  const annotationRegex = /\[(\d+)\]/g;
  const parts: (string | { type: "annotation"; number: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  match = annotationRegex.exec(sanitized);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push(sanitized.slice(lastIndex, match.index));
    }

    parts.push({
      type: "annotation",
      number: match[1],
    });

    lastIndex = match.index + match[0].length;

    match = annotationRegex.exec(sanitized);
  }

  if (lastIndex < sanitized.length) {
    parts.push(sanitized.slice(lastIndex));
  }

  return parts;
}
