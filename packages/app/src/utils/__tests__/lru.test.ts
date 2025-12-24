import { describe, expect, it } from "vitest";

import { LRUCache } from "../lru";

describe("LRUCache", () => {
  it("throws on invalid capacity", () => {
    expect(() => new LRUCache(0)).toThrow("capacity must be greater than 0");
  });

  it("evicts the least-recently-used entry", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);

    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("returns entries from most-recent to least-recent", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);

    expect(cache.entries()).toEqual([
      ["c", 3],
      ["a", 1],
    ]);
  });

  it("supports delete and clear", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.delete("a")).toBe(true);
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
