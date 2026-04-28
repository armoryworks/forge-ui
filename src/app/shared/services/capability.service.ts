import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { Observable, catchError, of, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CapabilityAuditEntry } from '../models/capability-audit-entry.model';
import { CapabilityDescriptor, CapabilityDescriptorEntry } from '../models/capability-descriptor.model';
import { CapabilityRelations } from '../models/capability-relations.model';
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
 */
@Injectable({ providedIn: 'root' })
export class CapabilityService {
  private readonly http = inject(HttpClient);

  private readonly _descriptor = signal<CapabilityDescriptor | null>(null);
  private readonly _loading = signal(false);

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

  /** Synchronous: is the capability enabled in the current snapshot? */
  isEnabled(code: string): boolean {
    return this._enabledByCode().get(code) === true;
  }

  /** Synchronous: does the catalog know about this capability code? */
  isKnown(code: string): boolean {
    return this._enabledByCode().has(code);
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

  /** Fetches the descriptor. Idempotent — call on login or after capability:changed. */
  load(): void {
    this._loading.set(true);
    this.http
      .get<CapabilityDescriptor>(`${environment.apiUrl}/capabilities/descriptor`)
      .pipe(
        tap((d) => this._descriptor.set(d)),
        catchError(() => {
          // Network / 401 / etc. — leave the snapshot empty so consumers fall
          // back to "feature unknown → don't show". Errors flow through the
          // global HTTP interceptor for user-facing toasts.
          this._descriptor.set(null);
          return of(null);
        }),
      )
      .subscribe(() => this._loading.set(false));
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

  /** Clears the in-memory descriptor on logout. */
  clear(): void {
    this._descriptor.set(null);
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
