import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ManualNumberSettings, ManualNumberEntity } from '../models/manual-number-settings.model';

const ALL_DISABLED: ManualNumberSettings = {
  parts: false, customers: false, vendors: false, leads: false,
  salesOrders: false, quotes: false, purchaseOrders: false,
  shipments: false, jobs: false, invoices: false, payments: false,
};

/**
 * Loads the per-entity manual-number flags once and exposes them as a signal so
 * any create/edit screen can gate its editable business-number field. Fails
 * closed (all disabled) if the config can't be read.
 */
@Injectable({ providedIn: 'root' })
export class ManualNumberSettingsService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = `${environment.apiUrl}/identifier-settings`;

  private readonly _settings = signal<ManualNumberSettings>(ALL_DISABLED);
  private loaded = false;

  /** Current flags (all-disabled until {@link load} completes). */
  readonly settings = this._settings.asReadonly();

  /** Loads the flags once; subsequent calls are no-ops. Call after login. */
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.http.get<ManualNumberSettings>(`${this.base}/manual-numbers`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this._settings.set(s),
        error: () => this._settings.set(ALL_DISABLED),
      });
  }

  /** Whether manual numbers are enabled for the given entity. */
  isEnabled(entity: ManualNumberEntity): boolean {
    return this._settings()[entity];
  }
}
