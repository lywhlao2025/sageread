import { getCurrentVectorModelConfig } from "@/utils/model";
import { AsyncQueue } from "@/utils/queue";
import { indexEpub, updateBookVectorizationMeta, getBookStatus } from "@/services/book-service";
import { useLlamaStore } from "@/store/llama-store";

interface VectorizationTask {
  bookId: string;
}

const queue = new AsyncQueue<VectorizationTask>();
let workerStarted = false;

async function processTask(task: VectorizationTask): Promise<void> {
  const status = await getBookStatus(task.bookId);
  const currentStatus = status?.metadata?.vectorization?.status;
  if (currentStatus === "processing" || currentStatus === "success") {
    return;
  }

  const vectorConfig = await getCurrentVectorModelConfig();
  if (vectorConfig.source === "local") {
    await useLlamaStore.getState().initializeEmbeddingService();
  }

  const version = 1;
  await updateBookVectorizationMeta(task.bookId, {
    status: "processing",
    model: vectorConfig.model,
    dimension: vectorConfig.dimension,
    version,
    startedAt: Date.now(),
  });

  try {
    const res = await indexEpub(task.bookId, {
      dimension: vectorConfig.dimension,
      embeddingsUrl: vectorConfig.embeddingsUrl,
      model: vectorConfig.model,
      apiKey: vectorConfig.apiKey,
    });

    if (res?.success && res.report) {
      await updateBookVectorizationMeta(task.bookId, {
        status: "success",
        chunkCount: res.report.total_chunks,
        dimension: res.report.vector_dimension,
        finishedAt: Date.now(),
      });
      return;
    }

    await updateBookVectorizationMeta(task.bookId, {
      status: "failed",
      finishedAt: Date.now(),
    });
  } catch (error) {
    await updateBookVectorizationMeta(task.bookId, {
      status: "failed",
      finishedAt: Date.now(),
    });
    console.error("Auto vectorization failed:", error);
  }
}

async function startWorker(): Promise<void> {
  if (workerStarted) return;
  workerStarted = true;

  // Keep a single background worker awaiting tasks.
  while (true) {
    const task = await queue.dequeue();
    if (!task) break;
    await processTask(task);
  }

  workerStarted = false;
}

export function enqueueVectorization(bookId: string): void {
  queue.enqueue({ bookId });
  void startWorker();
}
