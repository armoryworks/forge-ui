import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  CreateIntegrationRequest,
  IntegrationProviderInfo,
  UserIntegrationSummary,
} from '../models/user-integration.model';

@Injectable({ providedIn: 'root' })
export class UserIntegrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/user-integrations';

  readonly integrations = signal<UserIntegrationSummary[]>([]);
  readonly providers = signal<IntegrationProviderInfo[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  loadIntegrations(): void {
    this.loading.set(true);
    this.http.get<UserIntegrationSummary[]>(this.baseUrl).subscribe({
      next: (data) => {
        this.integrations.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadProviders(): void {
    this.http.get<IntegrationProviderInfo[]>(`${this.baseUrl}/providers`).subscribe({
      next: (data) => this.providers.set(data),
    });
  }

  create(request: CreateIntegrationRequest): Observable<UserIntegrationSummary> {
    return this.http.post<UserIntegrationSummary>(this.baseUrl, request).pipe(
      tap(() => this.loadIntegrations()),
    );
  }

  disconnect(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.loadIntegrations()),
    );
  }

  testConnection(id: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/${id}/test`, {});
  }

  updateCredentials(id: number, credentialsJson: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/credentials`, { credentialsJson });
  }

  updateConfig(id: number, configJson: string | null): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/config`, { configJson });
  }
}
