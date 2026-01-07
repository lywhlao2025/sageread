import { fetchWithTimeout } from "@/utils/fetch";

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

const PUBLIC_HIGHLIGHTS_BASE_URL = "http://localhost:8080";
const PUBLIC_HIGHLIGHTS_API_BASE = `${PUBLIC_HIGHLIGHTS_BASE_URL}/api/public-highlights/upsert`;
const DEVICE_ID_KEY = "sageread-public-highlights-device-id";

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

export const createOrUpdatePublicHighlight = async (payload: PublicHighlightRequest) => {
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
