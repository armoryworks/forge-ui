import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { AccountingProviderInfo } from '../../features/admin/models/accounting-provider.model';
import { AccountingEmployee } from '../../features/admin/models/accounting-employee.model';
import { AccountingItem } from '../../features/admin/models/accounting-item.model';
import { AccountingSyncStatus } from '../../features/admin/models/accounting-sync-status.model';

export interface AccountingMode {
  isConfigured: boolean;
  providerName: string | null;
  providerId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly http = inject(HttpClient);

  private readonly _mode = signal<AccountingMode>({ isConfigured: false, providerName: null, providerId: null });
  private readonly _providers = signal<AccountingProviderInfo[]>([]);
  private readonly _employees = signal<AccountingEmployee[]>([]);
  private readonly _items = signal<AccountingItem[]>([]);
  private readonly _syncStatus = signal<AccountingSyncStatus | null>(null);
  private readonly _loading = signal(false);

  readonly isStandalone = () => !this._mode().isConfigured;
  readonly isConfigured = () => this._mode().isConfigured;
  readonly providerName = () => this._mode().providerName;
  readonly providerId = () => this._mode().providerId;
  readonly providers = this._providers.asReadonly();
  readonly employees = this._employees.asReadonly();
  readonly items = this._items.asReadonly();
  readonly syncStatus = this._syncStatus.asReadonly();
  readonly loading = this._loading.asReadonly();

  load(): void {
    this.http.get<AccountingMode>(`${environment.apiUrl}/admin/accounting-mode`).subscribe({
      next: (mode) => this._mode.set(mode),
      error: () => this._mode.set({ isConfigured: false, providerName: null, providerId: null }),
    });
  }

  loadProviders(): void {
    this.http.get<AccountingProviderInfo[]>(`${environment.apiUrl}/accounting/providers`).subscribe({
      next: (providers) => this._providers.set(providers),
    });
  }

  setActiveProvider(providerId: string | null): void {
    this._loading.set(true);
    this.http.put<void>(`${environment.apiUrl}/admin/accounting-mode`, { providerId }).subscribe({
      next: () => {
        this._loading.set(false);
        this.load();
        this.loadProviders();
      },
      error: () => this._loading.set(false),
    });
  }

  loadEmployees(): void {
    this.http.get<AccountingEmployee[]>(`${environment.apiUrl}/accounting/employees`).subscribe({
      next: (employees) => this._employees.set(employees),
    });
  }

  loadItems(): void {
    this.http.get<AccountingItem[]>(`${environment.apiUrl}/accounting/items`).subscribe({
      next: (items) => this._items.set(items),
    });
  }

  loadSyncStatus(): void {
    this.http.get<AccountingSyncStatus>(`${environment.apiUrl}/accounting/sync-status`).subscribe({
      next: (status) => this._syncStatus.set(status),
    });
  }

  testConnection(): void {
    this._loading.set(true);
    this.http.post<{ success: boolean; providerName?: string; message?: string }>(
      `${environment.apiUrl}/accounting/test`, {}
    ).subscribe({
      next: () => this._loading.set(false),
      error: () => this._loading.set(false),
    });
  }

  disconnect(): void {
    this._loading.set(true);
    this.http.post<void>(`${environment.apiUrl}/accounting/disconnect`, {}).subscribe({
      next: () => {
        this._loading.set(false);
        this._mode.set({ isConfigured: false, providerName: null, providerId: null });
        this.loadProviders();
      },
      error: () => this._loading.set(false),
    });
  }
}
