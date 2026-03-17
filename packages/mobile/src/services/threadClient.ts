import type { ThreadModel } from "./adapters";
import { toThreadModel } from "./adapters";
import { threadService } from "./sharedServices";
import { isThreadMessage } from "./guards";

export async function getThreadById(threadId: string): Promise<ThreadModel> {
  const data = await threadService.getThreadById(threadId);
  const model = toThreadModel(data);
  return {
    ...model,
    messages: model.messages.filter(isThreadMessage),
  };
}

export async function getLatestThread(): Promise<ThreadModel | null> {
  const summaries = await threadService.getAllThreads();
  if (!summaries.length) return null;
  const latest = summaries[0];
  return getThreadById(latest.id);
}
