import { recordUserEvent } from "@/services/simple-mode-service";
import { useAuthStore } from "@/store/auth-store";
import { useModeStore } from "@/store/mode-store";
import { md5 } from "js-md5";

export async function trackUserAction(
  action: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const { mode } = useModeStore.getState();
  if (mode !== "simple") {
    return;
  }
  const { token, userId } = useAuthStore.getState();
  if (!token) {
    return;
  }
  const userIdPart = userId ?? "unknown";
  const eventId = md5(`${userIdPart}-${Date.now()}-${action}-${Math.random()}`);
  await recordUserEvent({
    eventId,
    eventType: `user_action_${action}`,
    payloadJson: payload ? JSON.stringify(payload) : undefined,
  });
}
