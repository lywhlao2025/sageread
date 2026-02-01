import { useAuthStore } from "@/store/auth-store";
import { recordUserEvent } from "./simple-mode-service";

type FrontendErrorPayload = {
  kind: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  reason?: string;
  path?: string;
  userAgent?: string;
  ts: number;
  version?: string;
};

let initialized = false;

function getVersion(): string | undefined {
  // Vite injects import.meta.env; fallback to package version if provided
  const v = (import.meta.env.VITE_APP_VERSION as string | undefined) || (import.meta.env.VITE_VERSION as string | undefined);
  return v || undefined;
}

async function send(payload: FrontendErrorPayload) {
  const token = useAuthStore.getState().token;
  if (!token) return; // avoid noisy anonymous reports; auth required by API

  try {
    await recordUserEvent({
      eventId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      eventType: "frontend_error",
      payloadJson: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[error-report] failed to send", err);
  }
}

function handleError(event: ErrorEvent) {
  const payload: FrontendErrorPayload = {
    kind: "error",
    message: event.message || "Unknown error",
    stack: event.error?.stack,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    path: location?.href,
    userAgent: navigator?.userAgent,
    ts: Date.now(),
    version: getVersion(),
  };
  void send(payload);
}

function handleRejection(event: PromiseRejectionEvent) {
  const reason = event.reason;
  const payload: FrontendErrorPayload = {
    kind: "unhandledrejection",
    message: reason?.message || String(reason ?? "Unknown rejection"),
    stack: reason?.stack,
    reason: typeof reason === "object" ? undefined : String(reason),
    path: location?.href,
    userAgent: navigator?.userAgent,
    ts: Date.now(),
    version: getVersion(),
  };
  void send(payload);
}

export function initErrorReporter() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
}
