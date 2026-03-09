import { Injectable, signal } from '@angular/core';

const STORAGE_PREFIX = 'qb-eng:pref:';

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly cache = signal<Map<string, unknown>>(new Map());

  constructor() {
    this.loadFromStorage();
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
  }

  reset(key: string): void {
    this.cache.update(map => {
      const next = new Map(map);
      next.delete(key);
      return next;
    });
    localStorage.removeItem(STORAGE_PREFIX + key);
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
