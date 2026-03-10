import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DrainResult, OfflineQueueEntry } from '../models/offline-queue-entry.model';

const DB_NAME = 'qb-engineer-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private dbPromise: Promise<IDBDatabase> | null = null;
  private draining = false;

  readonly queueSize = signal(0);

  constructor() {
    window.addEventListener('online', () => {
      this.drain();
    });

    this.refreshQueueSize();
  }

  async enqueue(method: string, url: string, body?: unknown): Promise<void> {
    const entry: OfflineQueueEntry = {
      id: crypto.randomUUID(),
      method,
      url,
      body: body ?? null,
      timestamp: Date.now(),
    };

    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await this.refreshQueueSize();
  }

  async drain(): Promise<DrainResult> {
    if (this.draining) {
      const remaining = await this.getQueueSize();
      return { processed: 0, failed: 0, remaining };
    }

    this.draining = true;
    let processed = 0;
    let failed = 0;

    try {
      const entries = await this.getAllEntries();

      for (const entry of entries) {
        try {
          await this.executeRequest(entry);
          await this.removeEntry(entry.id);
          processed++;
        } catch {
          failed++;
          break;
        }
      }
    } finally {
      this.draining = false;
      await this.refreshQueueSize();
    }

    const remaining = this.queueSize();

    console.log(
      `[OfflineQueue] Drain complete: ${processed} processed, ${failed} failed, ${remaining} remaining`
    );

    return { processed, failed, remaining };
  }

  async getQueueSize(): Promise<number> {
    try {
      const db = await this.openDb();
      return new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return 0;
    }
  }

  async clearQueue(): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Silently fail — queue ops are best-effort
    }

    await this.refreshQueueSize();
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private async getAllEntries(): Promise<OfflineQueueEntry[]> {
    const db = await this.openDb();
    return new Promise<OfflineQueueEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = (request.result as OfflineQueueEntry[]).sort(
          (a, b) => a.timestamp - b.timestamp
        );
        resolve(entries);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async removeEntry(id: string): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private executeRequest(entry: OfflineQueueEntry): Promise<unknown> {
    const method = entry.method.toUpperCase();

    switch (method) {
      case 'POST':
        return firstValueFrom(this.http.post(entry.url, entry.body));
      case 'PUT':
        return firstValueFrom(this.http.put(entry.url, entry.body));
      case 'PATCH':
        return firstValueFrom(this.http.patch(entry.url, entry.body));
      case 'DELETE':
        return firstValueFrom(this.http.delete(entry.url));
      default:
        return Promise.reject(new Error(`Unsupported HTTP method: ${method}`));
    }
  }

  private async refreshQueueSize(): Promise<void> {
    const size = await this.getQueueSize();
    this.queueSize.set(size);
  }
}
