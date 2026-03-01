export class LruTtlCache<K, V> {
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private readonly map = new Map<K, { value: V; expiresAt: number }>();

  constructor(params: { maxEntries: number; defaultTtlMs: number }) {
    this.maxEntries = Math.max(1, params.maxEntries);
    this.defaultTtlMs = Math.max(1, params.defaultTtlMs);
  }

  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }

    // Refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const effectiveTtl = Math.max(1, ttlMs ?? this.defaultTtlMs);
    const entry = { value, expiresAt: Date.now() + effectiveTtl };

    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, entry);

    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as K | undefined;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}
