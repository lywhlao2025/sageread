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

interface RetryQueueJob {
  id: number;
  job_type: string;
  payload_json: string;
  attempts: number;
  created_at: number;
  next_retry_at: number;
}

const PUBLIC_HIGHLIGHTS_BASE_URL = "http://localhost:8080";
const PUBLIC_HIGHLIGHTS_API_BASE = `${PUBLIC_HIGHLIGHTS_BASE_URL}/api/public-highlights/upsert`;
const PUBLIC_HIGHLIGHTS_DELETE_URL = `${PUBLIC_HIGHLIGHTS_BASE_URL}/api/public-highlights/delete`;
const DEVICE_ID_KEY = "sageread-public-highlights-device-id";
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEV_RETRY_INTERVAL_MS = 60_000;
const PROD_RETRY_INTERVAL_MS = 30 * 60_000;

let retryLoopStarted = false;
let retryLoopRunning = false;

const createDeviceId = () => {
  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID() as string;
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      job_type: jobType,
      payload_json: JSON.stringify(payload),
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

const computeNextRetryAt = (attempts: number) => {
  const backoffMs = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
  return Date.now() + backoffMs;
};

export const startPublicHighlightRetryLoop = () => {
  if (retryLoopStarted || typeof window === "undefined") {
    return;
  }
  retryLoopStarted = true;
  const intervalMs = import.meta.env.DEV ? DEV_RETRY_INTERVAL_MS : PROD_RETRY_INTERVAL_MS;

  setInterval(async () => {
    try {
      if (retryLoopRunning) return;
      retryLoopRunning = true;
      const now = Date.now();
      const cutoff = now - RETRY_WINDOW_MS;
      const jobs = await invoke<RetryQueueJob[]>("get_public_highlight_retry_jobs", {
        limit: 20,
        now,
        cutoff,
      });

      for (const job of jobs) {
        try {
          const payload = JSON.parse(job.payload_json);
          if (job.job_type === "delete") {
            await requestPublicHighlightDelete(payload);
          } else {
            await requestPublicHighlightUpsert(payload);
          }
          await invoke("mark_public_highlight_job_success", { id: job.id });
        } catch (error) {
          const attempts = (job.attempts ?? 0) + 1;
          await invoke("update_public_highlight_job_failure", {
            id: job.id,
            attempts,
            next_retry_at: computeNextRetryAt(attempts),
            last_error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      console.warn("Failed to process public highlight retry queue:", error);
    } finally {
      retryLoopRunning = false;
    }
  }, intervalMs);
};
