import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { Observable, catchError, finalize, map, of, share, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CapabilityAuditEntry } from '../models/capability-audit-entry.model';
import { CapabilityDescriptor, CapabilityDescriptorEntry } from '../models/capability-descriptor.model';
import { CapabilityRelations } from '../models/capability-relations.model';
import { CapabilitySnapshotCache } from '../models/capability-snapshot-cache.model';
import {
  CapabilityValidationItem,
  CapabilityValidationResult,
} from '../models/capability-validation.model';

/**
 * Phase 4 Phase-A — Capability descriptor service.
 *
 * Loads the full installation capability set from
 * `GET /api/v1/capabilities/descriptor` once after login. Components,
 * route guards, and structural directives consume `isEnabled(code)` to
 * decide whether to surface a feature. Phase B's `*appCap` directive +
 * `capabilityGuard()` factory sit on top of this service.
 *
 * Phase 4 Phase-C — Adds the mutation surface (`setEnabled`, `setConfig`,
 * `bulkToggle`) with optimistic-concurrency ETag round-trip. The service
 * holds the current ETag per row so admin UI components don't have to
 * thread it through manually — the latest descriptor's ETag is always
 * available via `getETag(code)`.
 *
 * Snapshot fallback (2026-08) — the service persists a compact last-known
 * `code → enabled` map to localStorage on every successful descriptor load.
 * When the descriptor is unavailable (fetch failed, or gating decisions are
 * made before `load()` resolves), `isEnabled` falls back to that cached
 * snapshot instead of silently answering `false` for everything — which used
 * to hide default-on features (e.g. the customer Contacts tab) with no
 * indication anywhere that the snapshot was the reason. When neither a live
 * nor a cached snapshot exists (first-ever login in a fresh browser AND the
 * fetch failed), `isEnabled(code, defaultWhenUnknown)` returns the caller-
 * supplied catalog default so default-on features fail OPEN. Every gating
 * decision made without a live snapshot emits a one-time console warning.
 * This is UX-only fallback: the server still enforces every gate with a 403.
 */
@Injectable({ providedIn: 'root' })
export class CapabilityService {
  private static readonly CACHE_KEY = 'forge-capability-snapshot';

  private readonly http = inject(HttpClient);

  private readonly _descriptor = signal<CapabilityDescriptor | null>(null);
  private readonly _loading = signal(false);
  private _inFlight: Observable<void> | null = null;

  /** Last-known snapshot hydrated from localStorage (per-install, survives reloads). */
  private readonly _cachedSnapshot = signal<CapabilitySnapshotCache | null>(this.readCache());

  /** One-time-per-code guard for the "gating without a live snapshot" warning. */
  private readonly warnedCodes = new Set<string>();

  readonly descriptor = this._descriptor.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly capabilities = computed<CapabilityDescriptorEntry[]>(
    () => this._descriptor()?.capabilities ?? [],
  );

  /** Quick lookup table built from the latest descriptor. */
  private readonly _enabledByCode = computed<Map<string, boolean>>(() => {
    const map = new Map<string, boolean>();
    for (const c of this.capabilities()) {
      map.set(c.code, c.enabled);
    }
    return map;
  });

  /** Phase 4 Phase-C — per-code lookup of the latest ETag string. */
  private readonly _entryByCode = computed<Map<string, CapabilityDescriptorEntry>>(() => {
    const map = new Map<string, CapabilityDescriptorEntry>();
    for (const c of this.capabilities()) {
      map.set(c.code, c);
    }
    return map;
  });

  /**
   * Synchronous: is the capability enabled?
   *
   * Resolution order:
   *  1. Live descriptor loaded → exact answer (unknown codes are `false`).
   *  2. No live descriptor but a cached last-known snapshot exists → the
   *     cached answer (stale cache is usable; refresh happens in background).
   *  3. Neither → `defaultWhenUnknown`. Callers gating a default-on feature
   *     pass `true` (mirroring the server catalog's `IsDefaultOn`) so those
   *     features fail OPEN instead of silently disappearing.
   *
   * Paths 2 and 3 emit a one-time-per-code console warning so a degraded
   * gating decision is always visible in the dev console.
   */
  isEnabled(code: string, defaultWhenUnknown = false): boolean {
    if (this._descriptor() !== null) {
      return this._enabledByCode().get(code) === true;
    }
    const cached = this._cachedSnapshot();
    if (cached && code in cached.enabled) {
      this.warnDegradedGating(
        code,
        `using last-known cached snapshot from ${cached.generatedAt} → ${cached.enabled[code] ? 'enabled' : 'disabled'}`,
      );
      return cached.enabled[code];
    }
    this.warnDegradedGating(
      code,
      `no cached snapshot either — falling back to defaultWhenUnknown=${defaultWhenUnknown}`,
    );
    return defaultWhenUnknown;
  }

  /**
   * Synchronous: does the LIVE descriptor know about this capability code?
   * Deliberately ignores the cached fallback snapshot — the layer-3
   * `capabilityGateInterceptor` uses `isKnown && !isEnabled` to short-circuit
   * requests, and a stale cache must never block a request the server would
   * allow. Without a live descriptor requests fall through to the server.
   */
  isKnown(code: string): boolean {
    return this._descriptor() !== null && this._enabledByCode().has(code);
  }

  /** Phase 4 Phase-C — latest ETag for the row, or `null` if unknown. */
  getETag(code: string): string | null {
    return this._entryByCode().get(code)?.eTag ?? null;
  }

  /** Phase 4 Phase-C — latest config ETag, or `null`. */
  getConfigETag(code: string): string | null {
    return this._entryByCode().get(code)?.configETag ?? null;
  }

  /** Phase 4 Phase-C — full entry for the row. */
  getEntry(code: string): CapabilityDescriptorEntry | undefined {
    return this._entryByCode().get(code);
  }

  /**
   * Fetches the descriptor. Idempotent — call on login or after
   * `capability:changed`.
   *
   * Returns an Observable that emits once when the descriptor has been
   * stored (or the load failed and the snapshot was cleared). Callers that
   * need to fire other capability-gated HTTP calls AFTER the descriptor is
   * known should chain on this — otherwise the layer-3 interceptor cannot
   * short-circuit those calls (it only blocks when the capability is
   * `isKnown && !isEnabled`; an unloaded descriptor returns false from
   * `isKnown` and the call falls through to the server).
   */
  load(): Observable<void> {
    if (this._inFlight) return this._inFlight;
    this._loading.set(true);
    this._inFlight = this.http
      .get<CapabilityDescriptor>(`${environment.apiUrl}/capabilities/descriptor`)
      .pipe(
        tap((d) => {
          this._descriptor.set(d);
          // A fresh live snapshot resets the degraded-gating warning guard
          // and refreshes the last-known fallback cache.
          this.warnedCodes.clear();
          this.persistCache(d);
        }),
        catchError(() => {
          // Network / 401 / etc. — fail OPEN, not closed. Keep whatever live
          // snapshot we already have (never clobber good state with null);
          // with no live snapshot, `isEnabled` serves the cached last-known
          // snapshot, then caller-supplied catalog defaults. Errors still
          // flow through the global HTTP interceptor for user-facing toasts.
          if (this._descriptor() === null) {
            const cached = this._cachedSnapshot();
            console.warn(
              '[CAPABILITY] Descriptor fetch failed with no live snapshot — ' +
              (cached
                ? `gating falls back to the last-known snapshot from ${cached.generatedAt}.`
                : 'gating falls back to per-call defaults (default-on capabilities fail open).'),
            );
          }
          return of(null);
        }),
        tap(() => this._loading.set(false)),
        map(() => void 0),
        finalize(() => { this._inFlight = null; }),
        share(),
      );
    return this._inFlight;
  }

  /**
   * Phase 4 Phase-C — Toggle a single capability with optimistic concurrency.
   * The current ETag (if known) is automatically attached as `If-Match`.
   * Errors (412 / 409) bubble up so the caller can render the envelope.
   */
  setEnabled(code: string, enabled: boolean, reason?: string): Observable<CapabilityDescriptorEntry> {
    const ifMatch = this.getETag(code);
    const headers = ifMatch ? new HttpHeaders({ 'If-Match': ifMatch }) : undefined;
    return this.http
      .put<CapabilityDescriptorEntry>(
        `${environment.apiUrl}/capabilities/${encodeURIComponent(code)}/enabled`,
        { enabled, reason: reason ?? null },
        { headers },
      )
      .pipe(
        tap((updated) => this._patchEntry(updated)),
        catchError((err) => throwError(() => err)),
      );
  }

  /** Phase 4 Phase-C — Update opaque config payload with optimistic concurrency. */
  setConfig(code: string, configJson: string, reason?: string): Observable<CapabilityDescriptorEntry> {
    const ifMatch = this.getConfigETag(code);
    const headers = ifMatch ? new HttpHeaders({ 'If-Match': ifMatch }) : undefined;
    return this.http
      .put<CapabilityDescriptorEntry>(
        `${environment.apiUrl}/capabilities/${encodeURIComponent(code)}/config`,
        { configJson, reason: reason ?? null },
        { headers },
      )
      .pipe(tap((updated) => this._patchEntry(updated)));
  }

  /** Phase 4 Phase-C — Atomic bulk toggle. Body items: { id, enabled, ifMatch? }. */
  bulkToggle(
    items: { id: string; enabled: boolean; ifMatch?: string }[],
    reason?: string,
  ): Observable<CapabilityDescriptorEntry[]> {
    return this.http
      .post<CapabilityDescriptorEntry[]>(
        `${environment.apiUrl}/capabilities/bulk-toggle`,
        { items, reason: reason ?? null },
      )
      .pipe(tap((rows) => rows.forEach((r) => this._patchEntry(r))));
  }

  private _patchEntry(updated: CapabilityDescriptorEntry): void {
    const current = this._descriptor();
    if (!current) return;
    const next = current.capabilities.map((c) =>
      c.code === updated.code
        ? { ...c, ...updated, dependencies: c.dependencies, mutexes: c.mutexes }
        : c,
    );
    this._descriptor.set({
      ...current,
      capabilities: next,
      enabledCount: next.filter((c) => c.enabled).length,
    });
  }

  /**
   * Clears the in-memory descriptor on logout. The localStorage fallback
   * cache is deliberately KEPT — capabilities are per-install (single-tenant
   * per database), not per-user, and keeping the cache closes the post-login
   * gating race window (consumers see last-known state instead of
   * "everything off" while the descriptor loads).
   */
  clear(): void {
    this._inFlight = null;
    this._descriptor.set(null);
  }

  // ─── Last-known snapshot cache ─────────────────────────────────────────

  private readCache(): CapabilitySnapshotCache | null {
    try {
      const raw = localStorage.getItem(CapabilityService.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CapabilitySnapshotCache;
      if (typeof parsed?.generatedAt !== 'string' || typeof parsed?.enabled !== 'object' || parsed.enabled === null) {
        return null;
      }
      return parsed;
    } catch {
      // Corrupt / inaccessible storage — behave as if no cache exists.
      return null;
    }
  }

  private persistCache(descriptor: CapabilityDescriptor): void {
    const cache: CapabilitySnapshotCache = {
      generatedAt: descriptor.generatedAt,
      enabled: Object.fromEntries(descriptor.capabilities.map((c) => [c.code, c.enabled])),
    };
    this._cachedSnapshot.set(cache);
    try {
      localStorage.setItem(CapabilityService.CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Quota / private-mode failures are non-fatal — the in-memory copy
      // still serves this session; the next successful load retries.
    }
  }

  /**
   * One-time-per-code dev-console warning for gating decisions made without
   * a live snapshot. Reset whenever a live descriptor arrives so a later
   * degraded phase warns again.
   */
  private warnDegradedGating(code: string, resolution: string): void {
    if (this.warnedCodes.has(code)) return;
    this.warnedCodes.add(code);
    console.warn(
      `[CAPABILITY] Gating decision for '${code}' made with no capability snapshot loaded ` +
      `(descriptor fetch failed or not yet resolved); ${resolution}. ` +
      'If a feature is unexpectedly hidden, this is why — check /admin/capabilities-debug.',
    );
  }

  /**
   * Phase 4 Phase-E — Fetch the dependency graph for a single capability.
   * Drives the per-capability detail page's "Dependencies / Required by /
   * Mutually exclusive" sections.
   */
  getRelations(code: string): Observable<CapabilityRelations> {
    return this.http.get<CapabilityRelations>(
      `${environment.apiUrl}/capabilities/${encodeURIComponent(code)}/relations`,
    );
  }

  /**
   * Phase 4 Phase-E — Fetch scoped audit history for a single capability.
   * Cursor pagination via `before` (ISO timestamp) + `take`.
   */
  getAuditLog(
    code: string,
    options: { before?: string; take?: number } = {},
  ): Observable<CapabilityAuditEntry[]> {
    let params = new HttpParams();
    if (options.before) params = params.set('before', options.before);
    if (options.take !== undefined) params = params.set('take', String(options.take));
    return this.http.get<CapabilityAuditEntry[]>(
      `${environment.apiUrl}/capabilities/${encodeURIComponent(code)}/audit-log`,
      { params },
    );
  }

  /**
   * Phase 4 Phase-E — Validate-only ("dry run") bulk-toggle. Returns the same
   * constraint-violation shape the bulk-toggle would, but does not persist.
   * Used by Phase G's preset-apply confirmation modal to list violations
   * before committing; admins can also preview a multi-toggle change here.
   */
  validate(items: CapabilityValidationItem[]): Observable<CapabilityValidationResult> {
    return this.http.post<CapabilityValidationResult>(
      `${environment.apiUrl}/capabilities/validate`,
      { items },
    );
  }
}
