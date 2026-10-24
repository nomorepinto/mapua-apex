import { Injectable } from '@nestjs/common';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Per-environment cache. Lambda recycles environments, so a miss just calls
 * the upstream service again. Both public checks fail open.
 */
@Injectable()
export class TtlCache {
  private readonly entries = new Map<string, Entry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}
