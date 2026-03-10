import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

export interface AccountingMode {
  isConfigured: boolean;
  providerName: string | null;
}

@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly http = inject(HttpClient);

  private readonly _mode = signal<AccountingMode>({ isConfigured: false, providerName: null });

  readonly isStandalone = () => !this._mode().isConfigured;
  readonly isConfigured = () => this._mode().isConfigured;
  readonly providerName = () => this._mode().providerName;

  load(): void {
    this.http.get<AccountingMode>(`${environment.apiUrl}/admin/accounting-mode`).subscribe({
      next: (mode) => this._mode.set(mode),
      error: () => this._mode.set({ isConfigured: false, providerName: null }),
    });
  }
}
