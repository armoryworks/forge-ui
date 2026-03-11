import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { QuickBooksConnectionStatus } from '../models/quickbooks-connection-status.model';

@Injectable({ providedIn: 'root' })
export class QuickBooksService {
  private readonly http = inject(HttpClient);
  private readonly snackbar = inject(SnackbarService);

  readonly status = signal<QuickBooksConnectionStatus | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  loadStatus(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<QuickBooksConnectionStatus>(`${environment.apiUrl}/quickbooks/status`).subscribe({
      next: (status) => {
        this.status.set(status);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load QuickBooks status');
        this.loading.set(false);
      },
    });
  }

  connect(): void {
    this.loading.set(true);
    this.http.get<{ authorizationUrl: string }>(`${environment.apiUrl}/quickbooks/authorize`).subscribe({
      next: (result) => {
        this.loading.set(false);
        window.location.href = result.authorizationUrl;
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to start QuickBooks authorization');
        this.loading.set(false);
      },
    });
  }

  disconnect(): void {
    this.loading.set(true);
    this.http.post<void>(`${environment.apiUrl}/quickbooks/disconnect`, {}).subscribe({
      next: () => {
        this.status.set({
          isConnected: false,
          companyId: null,
          companyName: null,
          connectedAt: null,
          tokenExpiresAt: null,
          lastSyncAt: null,
        });
        this.loading.set(false);
        this.snackbar.success('QuickBooks disconnected');
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to disconnect QuickBooks');
        this.loading.set(false);
      },
    });
  }

  testConnection(): void {
    this.loading.set(true);
    this.http.post<{ success: boolean; companyName?: string; message?: string }>(
      `${environment.apiUrl}/quickbooks/test`, {}
    ).subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result.success) {
          this.snackbar.success(`Connection verified — ${result.companyName ?? 'QuickBooks'}`);
        } else {
          this.snackbar.error(result.message ?? 'Connection test failed');
        }
      },
      error: (err) => {
        this.error.set(err.message ?? 'Connection test failed');
        this.loading.set(false);
      },
    });
  }
}
