import { describe, expect, it } from "vitest";

import { AsyncQueue } from "../queue";

describe("AsyncQueue", () => {
  it("dequeues immediately when items are available", async () => {
    const queue = new AsyncQueue<number>();
    queue.enqueue(1);

    await expect(queue.dequeue()).resolves.toBe(1);
  });

  it("waits for enqueue when empty", async () => {
    const queue = new AsyncQueue<number>();

    const next = queue.dequeue();
    queue.enqueue(42);

    await expect(next).resolves.toBe(42);
  });

  it("resolves to null after finish", async () => {
    const queue = new AsyncQueue<number>();

    const waiting = queue.dequeue();
    queue.finish();

    await expect(waiting).resolves.toBeNull();
    await expect(queue.dequeue()).resolves.toBeNull();
  });
});
