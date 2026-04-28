import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { catchError, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CapabilityDescriptor, CapabilityDescriptorEntry } from '../models/capability-descriptor.model';

/**
 * Phase 4 Phase-A — Capability descriptor service.
 *
 * Loads the full installation capability set from
 * `GET /api/v1/capabilities/descriptor` once after login. Components,
 * route guards, and structural directives consume `isEnabled(code)` to
 * decide whether to surface a feature. Phase B's `*appCap` directive +
 * `capabilityGuard()` factory will sit on top of this service.
 *
 * Phase A only delivers the read surface — mutation, SignalR push, and
 * cross-tab sync land in Phase C.
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

  /** Synchronous: is the capability enabled in the current snapshot? */
  isEnabled(code: string): boolean {
    return this._enabledByCode().get(code) === true;
  }

  /** Synchronous: does the catalog know about this capability code? */
  isKnown(code: string): boolean {
    return this._enabledByCode().has(code);
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

  /** Clears the in-memory descriptor on logout. */
  clear(): void {
    this._descriptor.set(null);
  }
}
