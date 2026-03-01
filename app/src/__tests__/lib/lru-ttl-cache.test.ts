import { describe, it, expect, vi } from "vitest";
import { LruTtlCache } from "@/lib/server/lru-ttl-cache";

describe("LruTtlCache", () => {
  it("stores and retrieves values", () => {
    const cache = new LruTtlCache<string, number>({ maxEntries: 2, defaultTtlMs: 1000 });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("expires entries based on ttl", () => {
    vi.useFakeTimers();
    const cache = new LruTtlCache<string, string>({ maxEntries: 2, defaultTtlMs: 1000 });
    cache.set("k", "v", 500);
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(600);
    expect(cache.get("k")).toBeNull();
    vi.useRealTimers();
  });

  it("evicts least-recently-used when over capacity", () => {
    const cache = new LruTtlCache<string, string>({ maxEntries: 2, defaultTtlMs: 1000 });
    cache.set("a", "1");
    cache.set("b", "2");
    // touch a so b becomes oldest
    expect(cache.get("a")).toBe("1");
    cache.set("c", "3");
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
  });
});
