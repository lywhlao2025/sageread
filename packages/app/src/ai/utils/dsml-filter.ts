export type DsmlFilter = {
  filter: (text: string) => string;
  flush: () => string;
};

export function createDsmlFilter(): DsmlFilter {
  const startTagRe = /<\|\s*DSML\s*\|[^>]*>/i;
  const endTagRe = /<\/\|\s*DSML\s*\|[^>]*>/i;
  const keepTail = 64;
  let buffer = "";
  let inDsml = false;
  let suppressLeadingNewline = false;
  let lastEmittedNewline = false;

  const processLine = (line: string) => {
    if (!line) return "";
    return line;
  };

  const filter = (text: string) => {
    let input = buffer + text;
    let output = "";
    let didStrip = false;
    buffer = "";

    while (input.length) {
      if (!inDsml) {
        if (suppressLeadingNewline) {
          if (input.startsWith("\n")) {
            input = input.slice(1);
            suppressLeadingNewline = false;
            continue;
          }
          suppressLeadingNewline = false;
        }
        const startMatch = input.match(startTagRe);
        const endMatch = input.match(endTagRe);
        if (endMatch && (startMatch == null || endMatch.index == null || endMatch.index < startMatch.index)) {
          const beforeEnd = input.slice(0, endMatch.index ?? 0);
          if (beforeEnd.trim()) {
            output += processLine(beforeEnd);
          }
          input = input.slice((endMatch.index ?? 0) + endMatch[0].length);
          didStrip = true;
          continue;
        }
        if (!startMatch || startMatch.index == null) {
          if (input.length > keepTail) {
            output += input.slice(0, -keepTail);
            buffer = input.slice(-keepTail);
          } else {
            buffer = input;
          }
          if (lastEmittedNewline && output.startsWith("\n")) {
            output = output.slice(1);
          }
          if (didStrip && output.includes("\n\n")) {
            output = output.replace(/\n{2,}/g, "\n");
          }
          if (output) {
            lastEmittedNewline = output.endsWith("\n");
          }
          return output;
        }
        output += processLine(input.slice(0, startMatch.index));
        input = input.slice(startMatch.index + startMatch[0].length);
        inDsml = true;
        didStrip = true;
      } else {
        const endMatch = input.match(endTagRe);
        if (!endMatch || endMatch.index == null) {
          buffer = input.length > keepTail ? input.slice(-keepTail) : input;
          if (lastEmittedNewline && output.startsWith("\n")) {
            output = output.slice(1);
          }
          if (didStrip && output.includes("\n\n")) {
            output = output.replace(/\n{2,}/g, "\n");
          }
          if (output) {
            lastEmittedNewline = output.endsWith("\n");
          }
          return output;
        }
        input = input.slice(endMatch.index + endMatch[0].length);
        inDsml = false;
        suppressLeadingNewline = true;
        didStrip = true;
      }
    }

    if (lastEmittedNewline && output.startsWith("\n")) {
      output = output.slice(1);
    }
    if (didStrip && output.includes("\n\n")) {
      output = output.replace(/\n{2,}/g, "\n");
    }
    if (output) {
      lastEmittedNewline = output.endsWith("\n");
    }
    return output;
  };

  const flush = () => {
    if (inDsml) {
      buffer = "";
      return "";
    }
    const out = processLine(buffer);
    buffer = "";
    if (lastEmittedNewline && out.startsWith("\n")) {
      return out.slice(1);
    }
    if (out) {
      lastEmittedNewline = out.endsWith("\n");
    }
    return out;
  };

  return { filter, flush };
}
