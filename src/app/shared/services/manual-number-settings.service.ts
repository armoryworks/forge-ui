import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { retry, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ManualNumberSettings, ManualNumberEntity } from '../models/manual-number-settings.model';

const ALL_DISABLED: ManualNumberSettings = {
  parts: false, customers: false, vendors: false, leads: false,
  salesOrders: false, quotes: false, purchaseOrders: false,
  shipments: false, jobs: false, invoices: false, payments: false,
};

/**
 * Loads the per-entity manual-number flags and exposes them as a signal so any
 * create/edit screen can gate its editable business-number field.
 *
 * Starts fail-closed (all disabled) and only latches once a load succeeds: a
 * transient failure — notably a 401 when login-time init races the token —
 * must not leave manual numbering silently off for the rest of the session.
 */
@Injectable({ providedIn: 'root' })
export class ManualNumberSettingsService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = `${environment.apiUrl}/identifier-settings`;

  private readonly _settings = signal<ManualNumberSettings>(ALL_DISABLED);
  private loaded = false;
  private inFlight = false;
  private refetchAfterFlight = false;

  /** Current flags (all-disabled until a load succeeds). */
  readonly settings = this._settings.asReadonly();

  /** Loads the flags once. A failed attempt does not count — call again to retry. */
  load(): void {
    if (this.loaded || this.inFlight) return;
    this.fetch();
  }

  /** Re-reads the flags, e.g. after an admin toggles one in settings. */
  refresh(): void {
    this.loaded = false;
    if (this.inFlight) {
      this.refetchAfterFlight = true;
      return;
    }
    this.fetch();
  }

  /** Whether manual numbers are enabled for the given entity. */
  isEnabled(entity: ManualNumberEntity): boolean {
    return this._settings()[entity];
  }

  private fetch(): void {
    this.inFlight = true;
    this.http.get<ManualNumberSettings>(`${this.base}/manual-numbers`)
      .pipe(
        retry({ count: 3, delay: (_, n) => timer(500 * 2 ** n) }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (s) => { this._settings.set({ ...ALL_DISABLED, ...s }); this.loaded = true; this.settle(); },
        error: () => this.settle(),
      });
  }

  private settle(): void {
    this.inFlight = false;
    if (!this.refetchAfterFlight) return;
    this.refetchAfterFlight = false;
    this.fetch();
  }
}
