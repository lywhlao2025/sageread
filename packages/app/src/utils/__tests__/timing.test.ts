import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce } from "../debounce";
import { throttle } from "../throttle";

describe("timing utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounce emits only the last call after delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });

  it("debounce respects emitLast=false", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100, { emitLast: false });

    debounced("first");
    debounced("second");

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });

  it("throttle emits immediately and then the trailing call", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    vi.setSystemTime(1000);
    throttled("first");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("first");

    vi.setSystemTime(1050);
    throttled("second");
    vi.setSystemTime(1080);
    throttled("third");

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("third");
  });

  it("throttle skips trailing call when emitLast=false", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100, { emitLast: false });

    vi.setSystemTime(1000);
    throttled("first");

    vi.setSystemTime(1050);
    throttled("second");

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
