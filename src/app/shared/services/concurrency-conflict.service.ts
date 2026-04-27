import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { TranslateService } from '@ngx-translate/core';

import { ConcurrencyConflictDialogComponent } from '../components/concurrency-conflict-dialog/concurrency-conflict-dialog.component';
import { ETagCacheService } from './etag-cache.service';

export interface ConcurrencyConflictEvent {
  resource: string | null;
  method: string;
  url: string;
}

/**
 * Phase 3 / WU-11 / TODO E1 — surfaces 412 Precondition Failed responses to
 * the user via a modal: "This record was changed by another user. Reload?"
 *
 * On Reload, the cached ETag for that resource is dropped so the next GET
 * fetches a fresh entity. The calling component then refreshes its form.
 *
 * On Cancel, nothing happens — the user keeps their edits.
 *
 * The service is consumed by `etagInterceptor`. Components needing a
 * post-reload callback can listen via the dialog's afterClosed observable
 * if they invoke the service directly, but the typical path is interceptor
 * -driven.
 *
 * Cases: CONC-OPTIMISTIC-LOCK-001.
 */
@Injectable({ providedIn: 'root' })
export class ConcurrencyConflictService {
  private readonly dialog = inject(MatDialog);
  private readonly etagCache = inject(ETagCacheService);
  private readonly translate = inject(TranslateService);

  // Coalesce simultaneous 412s for the same resource — only one modal at a time.
  private openFor: string | null = null;

  notify(evt: ConcurrencyConflictEvent): void {
    const key = evt.resource ?? evt.url;
    if (this.openFor === key) return;
    this.openFor = key;

    const ref = this.dialog.open(ConcurrencyConflictDialogComponent, {
      data: { resource: key },
      disableClose: true,
      width: '480px',
    });

    ref.afterClosed().subscribe((result) => {
      this.openFor = null;
      if (result === 'reload' && evt.resource) {
        // Drop the stale cache. Component-level reload is the caller's
        // responsibility — the dialog buttons trigger window-level reload
        // by default for safety, OR a soft refresh if the caller wired one.
        this.etagCache.clear(evt.resource);
        // Soft fallback: location reload re-fetches the current view.
        // Components with a finer-grained reload strategy should subscribe
        // to this.dialog and override; for the spec's "reload and try again"
        // pattern, a window reload is acceptable.
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    });
  }
}
