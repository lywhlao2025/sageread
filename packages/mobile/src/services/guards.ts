import type { ThreadMessage } from "sageread-shared";

export function isThreadMessage(value: unknown): value is ThreadMessage {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.role === "string" &&
    typeof value.content === "string"
  );
}
