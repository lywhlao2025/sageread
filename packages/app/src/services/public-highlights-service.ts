import { fetchWithTimeout } from "@/utils/fetch";
import { invoke } from "@tauri-apps/api/core";

type PublicHighlightAnchorType = "epub" | "txt" | "pdf";

export interface PublicHighlightRequest {
  deviceId: string;
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  anchor: string;
  quote: string;
  style?: string;
  color?: string;
  sectionId?: string | null;
  normStart?: number | null;
  normEnd?: number | null;
}

export interface PublicHighlightDeleteRequest {
  deviceId: string;
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  anchor: string;
  sectionId?: string | null;
  normStart?: number | null;
  normEnd?: number | null;
}

export interface PublicHighlightResponse {
  id: number;
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  anchor: string;
  sectionId?: string | null;
  normStart?: number | null;
  normEnd?: number | null;
  quote?: string | null;
  style?: string | null;
  color?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
}

interface RetryQueueJob {
  id: number;
  job_type: string;
  payload_json: string;
  attempts: number;
  created_at: number;
  next_retry_at: number;
}

const PUBLIC_HIGHLIGHTS_BASE_URL = "http://121.199.24.2:8080";
const PUBLIC_HIGHLIGHTS_API_BASE = `${PUBLIC_HIGHLIGHTS_BASE_URL}/api/public-highlights/upsert`;
const PUBLIC_HIGHLIGHTS_DELETE_URL = `${PUBLIC_HIGHLIGHTS_BASE_URL}/api/public-highlights/delete`;
const PUBLIC_HIGHLIGHTS_LIST_BATCH_URL = `${PUBLIC_HIGHLIGHTS_BASE_URL}/api/public-highlights/list-batch`;
const DEVICE_ID_KEY = "sageread-public-highlights-device-id";
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEV_RETRY_INTERVAL_MS = 60_000;
const PROD_RETRY_INTERVAL_MS = 30 * 60_000;
const PUBLIC_HIGHLIGHTS_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const PUBLIC_HIGHLIGHTS_CACHE_PREFIX = "sageread-public-highlights-cache";

const publicHighlightsCache = new Map<string, { expiresAt: number; data: PublicHighlightResponse[] }>();

let retryLoopStarted = false;
let retryLoopRunning = false;

const createDeviceId = () => {
  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID() as string;
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildCacheKey = (bookKey: string, anchorType: PublicHighlightAnchorType, range: string) =>
  `${PUBLIC_HIGHLIGHTS_CACHE_PREFIX}:${bookKey}:${anchorType}:${range}`;

const loadCachedHighlights = (cacheKey: string) => {
  const now = Date.now();
  const entry = publicHighlightsCache.get(cacheKey);
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }
  if (entry) {
    publicHighlightsCache.delete(cacheKey);
  }
  if (typeof localStorage === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(cacheKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { expiresAt: number; data: PublicHighlightResponse[] };
    if (!parsed || parsed.expiresAt <= now) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    publicHighlightsCache.set(cacheKey, parsed);
    return parsed.data;
  } catch {
    localStorage.removeItem(cacheKey);
    return null;
  }
};

const saveCachedHighlights = (cacheKey: string, data: PublicHighlightResponse[]) => {
  const entry = { expiresAt: Date.now() + PUBLIC_HIGHLIGHTS_CACHE_TTL_MS, data };
  publicHighlightsCache.set(cacheKey, entry);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // ignore storage errors
  }
};

const parseEpubRange = (range: string) => {
  const [type, sectionId, startRaw, endRaw] = range.split("|");
  if (type !== "section" || !sectionId) return null;
  const start = Number(startRaw);
  const end = Number(endRaw);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return { sectionId, start, end };
};

const filterHighlightsForRange = (highlights: PublicHighlightResponse[], range: string) => {
  const parsed = parseEpubRange(range);
  if (!parsed) return highlights;
  return highlights.filter((highlight) => {
    if (!highlight.sectionId || highlight.sectionId !== parsed.sectionId) return false;
    if (highlight.normStart == null || highlight.normEnd == null) return false;
    return highlight.normEnd >= parsed.start && highlight.normStart <= parsed.end;
  });
};

export const getPublicHighlightsDeviceId = async () => {
  if (typeof localStorage === "undefined") {
    return createDeviceId();
  }
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = createDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, fresh);
  return fresh;
};

const requestPublicHighlightUpsert = async (payload: PublicHighlightRequest) => {
  const response = await fetchWithTimeout(
    PUBLIC_HIGHLIGHTS_API_BASE,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    10000,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Public highlight upload failed");
  }

  return response.json();
};

const requestPublicHighlightDelete = async (payload: PublicHighlightDeleteRequest) => {
  const response = await fetchWithTimeout(
    PUBLIC_HIGHLIGHTS_DELETE_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    10000,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Public highlight delete failed");
  }
};

const requestPublicHighlightsBatch = async (params: {
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  ranges: string[];
}) => {
  const searchParams = new URLSearchParams({
    bookKey: params.bookKey,
    anchorType: params.anchorType,
  });
  for (const range of params.ranges) {
    searchParams.append("ranges", range);
  }

  const response = await fetchWithTimeout(
    `${PUBLIC_HIGHLIGHTS_LIST_BATCH_URL}?${searchParams.toString()}`,
    {
      method: "GET",
    },
    10000,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Public highlight list batch failed");
  }

  return response.json() as Promise<PublicHighlightResponse[]>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>) => {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < RETRY_MAX_ATTEMPTS) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      await sleep(delay);
      attempt += 1;
    }
  }
  throw lastError;
};

const enqueueRetryJob = async (jobType: "upsert" | "delete", payload: unknown) => {
  try {
    await invoke<number>("enqueue_public_highlight_job", {
      jobType,
      payloadJson: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Failed to enqueue public highlight job:", error);
  }
};

export const createOrUpdatePublicHighlight = async (payload: PublicHighlightRequest) => {
  try {
    return await withRetry(() => requestPublicHighlightUpsert(payload));
  } catch (error) {
    await enqueueRetryJob("upsert", payload);
    throw error;
  }
};

export const deletePublicHighlight = async (payload: PublicHighlightDeleteRequest) => {
  try {
    await withRetry(() => requestPublicHighlightDelete(payload));
  } catch (error) {
    await enqueueRetryJob("delete", payload);
    throw error;
  }
};

export const listPublicHighlightsBatch = (params: {
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  ranges: string[];
}) => {
  return requestPublicHighlightsBatch(params);
};

export const listPublicHighlightsBatchCached = async (params: {
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  ranges: string[];
}) => {
  const uniqueRanges = Array.from(new Set(params.ranges ?? []));
  if (!uniqueRanges.length) return [];

  const highlights: PublicHighlightResponse[] = [];
  const seen = new Set<number>();
  const missing: string[] = [];

  for (const range of uniqueRanges) {
    const cacheKey = buildCacheKey(params.bookKey, params.anchorType, range);
    const cached = loadCachedHighlights(cacheKey);
    if (cached) {
      for (const item of cached) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          highlights.push(item);
        }
      }
    } else {
      missing.push(range);
    }
  }

  if (!missing.length) return highlights;

  const fetched = await requestPublicHighlightsBatch({
    bookKey: params.bookKey,
    anchorType: params.anchorType,
    ranges: missing,
  });

  for (const range of missing) {
    const filtered = filterHighlightsForRange(fetched, range);
    const cacheKey = buildCacheKey(params.bookKey, params.anchorType, range);
    saveCachedHighlights(cacheKey, filtered);
    for (const item of filtered) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        highlights.push(item);
      }
    }
  }

  return highlights;
};

export const getCachedPublicHighlights = (params: {
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  ranges: string[];
}) => {
  const uniqueRanges = Array.from(new Set(params.ranges ?? []));
  if (!uniqueRanges.length) return [];
  const highlights: PublicHighlightResponse[] = [];
  const seen = new Set<number>();
  for (const range of uniqueRanges) {
    const cacheKey = buildCacheKey(params.bookKey, params.anchorType, range);
    const cached = loadCachedHighlights(cacheKey);
    if (!cached) continue;
    for (const item of cached) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        highlights.push(item);
      }
    }
  }
  return highlights;
};

export const prefetchPublicHighlightsBatch = async (params: {
  bookKey: string;
  anchorType: PublicHighlightAnchorType;
  ranges: string[];
}) => {
  const uniqueRanges = Array.from(new Set(params.ranges ?? []));
  const missing = uniqueRanges.filter((range) => {
    const cacheKey = buildCacheKey(params.bookKey, params.anchorType, range);
    return !loadCachedHighlights(cacheKey);
  });
  if (!missing.length) return;

  try {
    const fetched = await requestPublicHighlightsBatch({
      bookKey: params.bookKey,
      anchorType: params.anchorType,
      ranges: missing,
    });
    for (const range of missing) {
      const filtered = filterHighlightsForRange(fetched, range);
      const cacheKey = buildCacheKey(params.bookKey, params.anchorType, range);
      saveCachedHighlights(cacheKey, filtered);
    }
  } catch (error) {
    console.warn("Failed to prefetch public highlights:", error);
  }
};

const computeNextRetryAt = (attempts: number) => {
  const backoffMs = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
  return Date.now() + backoffMs;
};

export const startPublicHighlightRetryLoop = () => {
  if (retryLoopStarted || typeof window === "undefined") {
    return;
  }
  if (import.meta.env.VITE_E2E === "1") {
    return;
  }
  retryLoopStarted = true;
  const intervalMs = import.meta.env.DEV ? DEV_RETRY_INTERVAL_MS : PROD_RETRY_INTERVAL_MS;

  setInterval(async () => {
    try {
      if (retryLoopRunning) return;
      retryLoopRunning = true;
      console.info("[PublicHighlights] Retry loop tick");
      const now = Date.now();
      const cutoff = now - RETRY_WINDOW_MS;
      const jobs = await invoke<RetryQueueJob[]>("get_public_highlight_retry_jobs", {
        limit: 20,
        now,
        cutoff,
      });
      if (!jobs.length) {
        console.info("[PublicHighlights] No retry jobs available");
      } else {
        console.info(`[PublicHighlights] Processing ${jobs.length} retry job(s)`);
      }

      for (const job of jobs) {
        try {
          const payload = JSON.parse(job.payload_json);
          if (job.job_type === "delete") {
            await requestPublicHighlightDelete(payload);
          } else {
            await requestPublicHighlightUpsert(payload);
          }
          await invoke("mark_public_highlight_job_success", { id: job.id });
          console.info(`[PublicHighlights] Job ${job.id} succeeded`);
        } catch (error) {
          const attempts = (job.attempts ?? 0) + 1;
          await invoke("update_public_highlight_job_failure", {
            id: job.id,
            attempts,
            nextRetryAt: computeNextRetryAt(attempts),
            lastError: error instanceof Error ? error.message : String(error),
          });
          console.warn(`[PublicHighlights] Job ${job.id} failed (attempt ${attempts})`);
        }
      }
    } catch (error) {
      console.warn("Failed to process public highlight retry queue:", error);
    } finally {
      retryLoopRunning = false;
    }
  }, intervalMs);
};
