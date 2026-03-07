/* @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { useAuthStore } from "@/store/auth-store";

function mockFetch(response: Response) {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe("simple-mode-service auth invalidation", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useAuthStore.setState({
      token: "test-token",
      userId: 1,
      phone: "13800138000",
      email: null,
      quota: null,
      hasHydrated: true,
      isSwitching: false,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    useAuthStore.setState({ token: null, userId: null, phone: null, email: null, quota: null });
  });

  it("clears auth on UNAUTHORIZED for requestJson calls", async () => {
    const payload = { success: false, error: { code: "UNAUTHORIZED", message: "invalid" } };
    globalThis.fetch = mockFetch(
      new Response(JSON.stringify(payload), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { fetchQuota } = await import("@/services/simple-mode-service");
    const clearSpy = vi.spyOn(useAuthStore.getState(), "clearAuth");
    await expect(fetchQuota()).rejects.toBeTruthy();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("does not clear auth on non-auth errors", async () => {
    const payload = { success: false, error: { code: "INTERNAL_ERROR", message: "boom" } };
    globalThis.fetch = mockFetch(
      new Response(JSON.stringify(payload), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { fetchQuota } = await import("@/services/simple-mode-service");
    const clearSpy = vi.spyOn(useAuthStore.getState(), "clearAuth");
    await expect(fetchQuota()).rejects.toBeTruthy();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe("test-token");
  });

  it("clears auth on UNAUTHORIZED for streaming calls", async () => {
    const payload = { success: false, error: { code: "UNAUTHORIZED", message: "invalid" } };
    globalThis.fetch = mockFetch(
      new Response(JSON.stringify(payload), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { streamSimpleModeLlm } = await import("@/services/simple-mode-service");
    const clearSpy = vi.spyOn(useAuthStore.getState(), "clearAuth");
    const iterator = streamSimpleModeLlm({
      taskType: "chat",
      messages: [{ role: "user", content: "hi" }],
      requestId: "req-1",
    });

    await expect(iterator.next()).rejects.toBeTruthy();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
