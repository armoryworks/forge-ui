import { Injectable } from '@angular/core';

/**
 * Phase 3 / WU-11 / TODO E1 — in-memory cache of ETags keyed by resource path.
 *
 * The HTTP interceptor populates this from PATCH/PUT/POST/GET responses and
 * pulls If-Match values for subsequent mutating requests.
 *
 * The cache is intentionally in-memory only — on full reload, the next GET
 * will refresh the ETag automatically.
 */
@Injectable({ providedIn: 'root' })
export class ETagCacheService {
  private readonly etags = new Map<string, string>();

  get(key: string): string | undefined {
    return this.etags.get(key);
  }

  set(key: string, value: string): void {
    this.etags.set(key, value);
  }

  clear(key?: string): void {
    if (key) {
      this.etags.delete(key);
    } else {
      this.etags.clear();
    }
  }

  // For diagnostics/tests
  size(): number {
    return this.etags.size;
  }
}
