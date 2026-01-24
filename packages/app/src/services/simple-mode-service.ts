import { useAuthStore } from "@/store/auth-store";
import { fetch as fetchTauri } from "@tauri-apps/plugin-http";

export interface AuthPayload {
  userId: number;
  phone: string;
  token: string;
}

export interface QuotaPayload {
  totalCount: number;
  usedCount: number;
  remainingCount: number;
}

export interface SimpleModeMessagePayload {
  role: string;
  content: string;
}

export interface SimpleModeLlmPayload {
  output: string;
  usageCount: number;
  remainingCount: number;
}

export interface SimpleModeLlmStreamEvent {
  type: "delta" | "done" | "error";
  content?: string;
  usageCount?: number;
  remainingCount?: number;
  error?: {
    code: string;
    message: string;
  };
}

export class SimpleModeApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const BASE_URL = (import.meta.env.VITE_SAGEREAD_SERVER_BASE_URL as string | undefined) ?? "http://127.0.0.1:8080";
const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI__?.invoke);
const fetchClient: typeof fetch = isTauri ? (fetchTauri as unknown as typeof fetch) : fetch;

async function requestJson<T>(path: string, options: RequestInit, requireAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (requireAuth) {
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new SimpleModeApiError("UNAUTHORIZED", "Missing token");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchClient(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    const code = payload?.error?.code || `HTTP_${response.status}`;
    const message = payload?.error?.message || response.statusText || "Request failed";
    throw new SimpleModeApiError(code, message);
  }

  return payload.data as T;
}

function buildAuthHeaders(headers: Record<string, string> = {}, requireAuth = false): Record<string, string> {
  if (!requireAuth) {
    return headers;
  }
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new SimpleModeApiError("UNAUTHORIZED", "Missing token");
  }
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

async function* parseSseStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  if (!response.body) {
    throw new SimpleModeApiError("STREAM_ERROR", "Missing response stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {});
      return;
    }

    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let boundaryIndex = buffer.search(/\r?\n\r?\n/);
    while (boundaryIndex !== -1) {
      const boundaryLength = buffer.startsWith("\r\n", boundaryIndex) ? 4 : 2;
      const rawChunk = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + boundaryLength);
      boundaryIndex = buffer.search(/\r?\n\r?\n/);

      if (!rawChunk) {
        continue;
      }

      const lines = rawChunk.split(/\r?\n/);
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data += line.slice(5).trim();
        }
      }

      if (data) {
        yield { event, data };
      }
    }
  }
}

export async function sendSmsCode(phone: string): Promise<void> {
  await requestJson<void>(
    "/api/auth/sms/send",
    {
      method: "POST",
      body: JSON.stringify({ phone }),
    },
    false,
  );
}

export async function registerUser(phone: string, code: string): Promise<AuthPayload> {
  return requestJson<AuthPayload>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    },
    false,
  );
}

export async function loginUser(phone: string, code: string): Promise<AuthPayload> {
  return requestJson<AuthPayload>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    },
    false,
  );
}

export async function fetchQuota(): Promise<QuotaPayload> {
  return requestJson<QuotaPayload>(
    "/api/user/quota",
    {
      method: "GET",
    },
    true,
  );
}

export async function requestSimpleModeLlm(params: {
  taskType: "chat" | "translate";
  messages: SimpleModeMessagePayload[];
  requestId: string;
  docType?: string;
  sourceLang?: string;
  targetLang?: string;
}): Promise<SimpleModeLlmPayload> {
  return requestJson<SimpleModeLlmPayload>(
    "/api/simple-mode/llm",
    {
      method: "POST",
      body: JSON.stringify(params),
    },
    true,
  );
}

export async function* streamSimpleModeLlm(params: {
  taskType: "chat" | "translate";
  messages: SimpleModeMessagePayload[];
  requestId: string;
  docType?: string;
  sourceLang?: string;
  targetLang?: string;
  abortSignal?: AbortSignal;
}): AsyncGenerator<SimpleModeLlmStreamEvent> {
  const headers = buildAuthHeaders(
    {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    true,
  );

  const response = await fetch(`${BASE_URL}/api/simple-mode/llm`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
    signal: params.abortSignal,
  });

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const code = payload?.error?.code || `HTTP_${response.status}`;
    const message = payload?.error?.message || response.statusText || "Request failed";
    throw new SimpleModeApiError(code, message);
  }

  for await (const { event, data } of parseSseStream(response, params.abortSignal)) {
    let payload: SimpleModeLlmStreamEvent | null = null;
    try {
      payload = JSON.parse(data) as SimpleModeLlmStreamEvent;
    } catch (error) {
      throw new SimpleModeApiError("STREAM_ERROR", "Invalid SSE payload");
    }

    const type = payload.type || (event as SimpleModeLlmStreamEvent["type"]);
    if (type === "error") {
      const code = payload.error?.code || "MODEL_ERROR";
      const message = payload.error?.message || "Stream failed";
      throw new SimpleModeApiError(code, message);
    }
    yield { ...payload, type };
  }
}
