import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { SettingsCatalogEntry } from '../models/setting-entry.model';

/**
 * Phase 1m — admin settings service. Wraps /api/v1/admin/settings.
 * Group list cached in memory after the first load; entries refetched
 * per-group navigation so secret-mask freshness reflects recent saves.
 */
@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/admin/settings';

  readonly groups = signal<string[]>([]);
  readonly entries = signal<SettingsCatalogEntry[]>([]);
  readonly loading = signal(false);

  loadGroups(): void {
    this.http.get<string[]>(`${this.base}/groups`).subscribe({
      next: (groups) => this.groups.set(groups),
    });
  }

  loadGroup(group: string): void {
    this.loading.set(true);
    const params = new URLSearchParams({ group });
    this.http.get<SettingsCatalogEntry[]>(`${this.base}?${params}`).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Persist a single setting. Empty value → server erases the row →
   * next read returns the descriptor's DefaultValue.
   */
  updateSetting(key: string, value: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/${encodeURIComponent(key)}`, { value }).pipe(
      // After a successful save we don't auto-reload — the caller
      // typically only edited one field and the masked-value display
      // is the same regardless. Re-call loadGroup() if a stale state
      // becomes a problem.
      tap(() => undefined),
    );
  }
}
