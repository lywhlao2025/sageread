function ensureSuffix(baseUrl: string, suffix: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`;
}

function hasV1Path(baseUrl: string): boolean {
  return /\/v1(\/|$)/.test(baseUrl.replace(/\/+$/, ""));
}

function isLocalhostUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

/**
 * Many local “OpenAI compatible” servers (e.g. Ollama) require the `/v1` prefix.
 * Users often paste `http://127.0.0.1:11434` which would otherwise 404.
 */
export function normalizeOpenAICompatibleBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) return baseUrl;
  const trimmed = baseUrl.trim();
  if (!trimmed) return trimmed;
  if (hasV1Path(trimmed)) return trimmed.replace(/\/+$/, "");
  if (!isLocalhostUrl(trimmed)) return trimmed.replace(/\/+$/, "");
  return ensureSuffix(trimmed, "/v1");
}

