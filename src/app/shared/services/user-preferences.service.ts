import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

interface UserPreferenceResponse {
  key: string;
  valueJson: string;
}

const STORAGE_PREFIX = 'qb-eng:pref:';
const DEBOUNCE_MS = 500;

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/user-preferences`;
  private readonly cache = signal<Map<string, unknown>>(new Map());
  private readonly pendingUpdates = new Map<string, unknown>();
  private readonly flushSubject = new Subject<void>();
  private loaded = false;

  constructor() {
    this.loadFromStorage();

    this.flushSubject.pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => {
      this.flushToApi();
    });
  }

  load(): void {
    this.http.get<UserPreferenceResponse[]>(this.base).subscribe({
      next: (prefs) => {
        const map = new Map<string, unknown>();
        for (const p of prefs) {
          try {
            const value = JSON.parse(p.valueJson);
            map.set(p.key, value);
            localStorage.setItem(STORAGE_PREFIX + p.key, p.valueJson);
          } catch {
            // Skip malformed entries
          }
        }
        this.cache.set(map);
        this.loaded = true;
      },
      error: () => {
        // API unavailable — keep localStorage cache
        this.loaded = true;
      },
    });
  }

  get<T>(key: string): T | null {
    return (this.cache().get(key) as T) ?? null;
  }

  set(key: string, value: unknown): void {
    this.cache.update(map => {
      const next = new Map(map);
      next.set(key, value);
      return next;
    });
    this.saveToStorage(key, value);
    this.pendingUpdates.set(key, value);
    this.flushSubject.next();
  }

  reset(key: string): void {
    this.cache.update(map => {
      const next = new Map(map);
      next.delete(key);
      return next;
    });
    localStorage.removeItem(STORAGE_PREFIX + key);
    this.pendingUpdates.delete(key);

    this.http.delete(`${this.base}/${encodeURIComponent(key)}`).subscribe();
  }

  private flushToApi(): void {
    if (this.pendingUpdates.size === 0) return;

    const preferences: Record<string, unknown> = {};
    for (const [key, value] of this.pendingUpdates) {
      preferences[key] = value;
    }
    this.pendingUpdates.clear();

    this.http.patch(this.base, { preferences }).subscribe();
  }

  private loadFromStorage(): void {
    const map = new Map<string, unknown>();
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey?.startsWith(STORAGE_PREFIX)) {
        const key = storageKey.slice(STORAGE_PREFIX.length);
        try {
          map.set(key, JSON.parse(localStorage.getItem(storageKey)!));
        } catch {
          // Ignore malformed entries
        }
      }
    }
    this.cache.set(map);
  }

  private saveToStorage(key: string, value: unknown): void {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  }
}
