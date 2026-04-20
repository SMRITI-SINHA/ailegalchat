/**
 * In-memory response cache for expensive AI calls that return the same
 * result for the same input (research queries, kanoon searches, memos).
 *
 * TTL: 24 hours by default.
 * Max entries: 500 (oldest evicted when full).
 *
 * NOT used for personalised calls (chat, drafts) since those depend on
 * per-user context and uploaded documents.
 */

import crypto from "crypto";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

class AICache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private totalHits = 0;
  private totalMisses = 0;

  constructor(ttlMs = DEFAULT_TTL_MS, maxEntries = MAX_ENTRIES) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;

    // Sweep expired entries every hour
    setInterval(() => this.sweep(), 60 * 60 * 1000).unref();
  }

  /** Build a stable cache key from arbitrary params */
  private makeKey(namespace: string, params: Record<string, unknown>): string {
    const canonical = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash("sha256").update(namespace + canonical).digest("hex").slice(0, 16);
    return `${namespace}:${hash}`;
  }

  get<T>(namespace: string, params: Record<string, unknown>): T | null {
    const key = this.makeKey(namespace, params);
    const entry = this.store.get(key);

    if (!entry) {
      this.totalMisses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.totalMisses++;
      return null;
    }

    entry.hits++;
    this.totalHits++;
    return entry.value as T;
  }

  set<T>(namespace: string, params: Record<string, unknown>, value: T): void {
    if (this.store.size >= this.maxEntries) {
      // Evict the oldest entry
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const key = this.makeKey(namespace, params);
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
      hits: 0,
    });
  }

  /** Remove expired entries */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  stats() {
    return {
      entries: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.totalHits,
      misses: this.totalMisses,
      hitRate: this.totalHits + this.totalMisses === 0
        ? "0%"
        : `${Math.round((this.totalHits / (this.totalHits + this.totalMisses)) * 100)}%`,
    };
  }
}

export const aiCache = new AICache();
