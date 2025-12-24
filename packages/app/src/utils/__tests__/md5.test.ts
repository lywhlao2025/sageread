import { describe, expect, it } from "vitest";

import { isMd5, md5Fingerprint } from "../md5";

describe("md5 utilities", () => {
  it("validates md5 hashes", () => {
    expect(isMd5("5d41402abc4b2a76b9719d911017c592")).toBe(true);
    expect(isMd5("5D41402ABC4B2A76B9719D911017C592")).toBe(false);
    expect(isMd5("not-a-hash")).toBe(false);
  });

  it("creates a deterministic fingerprint", () => {
    expect(md5Fingerprint("hello")).toBe("5d41402");
  });
});
