export type HttpClient = {
  get: <T>(path: string, init?: RequestInit) => Promise<T>;
  post: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  put: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  del: <T>(path: string, init?: RequestInit) => Promise<T>;
};

export interface HttpClientOptions {
  timeoutMs?: number;
  retries?: number;
}

export function createHttpClient(
  baseUrl: string,
  headers: Record<string, string> = {},
  options: HttpClientOptions = {},
): HttpClient {
  const timeoutMs = options.timeoutMs ?? 15000;
  const retries = options.retries ?? 1;
  const maxAttempts = retries + 1;

  const request = async <T>(method: string, path: string, body?: unknown, init: RequestInit = {}) => {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
            ...(init.headers || {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          ...init,
        });
        if (!res.ok) {
          const text = await res.text();
          if (res.status >= 500 && attempt < maxAttempts) {
            const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error("HTTP request failed after retries");
  };

  return {
    get: (path, init) => request("GET", path, undefined, init),
    post: (path, body, init) => request("POST", path, body, init),
    put: (path, body, init) => request("PUT", path, body, init),
    del: (path, init) => request("DELETE", path, undefined, init),
  };
}
