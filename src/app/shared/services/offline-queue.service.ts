import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DrainResult, OfflineQueueEntry } from '../models/offline-queue-entry.model';
import { SyncConflict } from '../models/sync-conflict.model';
import { SyncResult } from '../models/sync-result.model';

const DB_NAME = 'qb-engineer-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isDraining = false;

  readonly pendingCount = signal(0);
  /** @deprecated Use pendingCount instead */
  readonly queueSize = computed(() => this.pendingCount());
  readonly syncing = signal(false);
  readonly lastSyncResult = signal<SyncResult | null>(null);
  readonly conflict = signal<SyncConflict | null>(null);

  constructor() {
    window.addEventListener('online', () => {
      this.drain();
    });

    this.refreshQueueSize();
  }

  async enqueue(method: string, url: string, body?: unknown, description?: string): Promise<void> {
    const entry: OfflineQueueEntry = {
      id: crypto.randomUUID(),
      method,
      url,
      body: body ?? null,
      timestamp: Date.now(),
      description: description ?? `${method.toUpperCase()} ${url}`,
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
    if (this.isDraining) {
      const remaining = await this.getQueueSize();
      return { processed: 0, failed: 0, remaining };
    }

    this.isDraining = true;
    this.syncing.set(true);
    let processed = 0;
    let failed = 0;

    try {
      const entries = await this.getAllEntries();

      for (const entry of entries) {
        try {
          await this.executeRequest(entry);
          await this.removeEntry(entry.id);
          processed++;
          await this.refreshQueueSize();
        } catch (err) {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            // Conflict — pause drain and emit for UI
            const conflictData: SyncConflict = {
              entryId: entry.id,
              description: entry.description ?? `${entry.method.toUpperCase()} ${entry.url}`,
              url: entry.url,
              method: entry.method,
              localValue: entry.body,
              serverMessage: err.error?.detail ?? err.error?.title ?? 'A newer version exists on the server.',
            };
            this.conflict.set(conflictData);
            failed++;
            break;
          }
          failed++;
          break;
        }
      }
    } finally {
      this.isDraining = false;
      this.syncing.set(false);
      await this.refreshQueueSize();
    }

    const remaining = this.pendingCount();

    const result: SyncResult = {
      processed,
      failed,
      remaining,
      success: failed === 0,
      timestamp: Date.now(),
    };
    this.lastSyncResult.set(result);

    return { processed, failed, remaining };
  }

  async resolveConflictKeepMine(entryId: string): Promise<void> {
    const entries = await this.getAllEntries();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) {
      this.conflict.set(null);
      return;
    }

    try {
      // Retry with force header
      await this.executeRequest(entry, true);
      await this.removeEntry(entry.id);
    } catch {
      // Still failing — leave in queue
    }

    this.conflict.set(null);
    await this.refreshQueueSize();

    // Resume draining remaining items
    await this.drain();
  }

  async resolveConflictKeepServer(entryId: string): Promise<void> {
    await this.removeEntry(entryId);
    this.conflict.set(null);
    await this.refreshQueueSize();

    // Resume draining remaining items
    await this.drain();
  }

  async resolveConflictCancel(): Promise<void> {
    this.conflict.set(null);
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

  private executeRequest(entry: OfflineQueueEntry, force = false): Promise<unknown> {
    const method = entry.method.toUpperCase();
    const headers = force ? { 'X-Force-Overwrite': 'true' } : undefined;

    switch (method) {
      case 'POST':
        return firstValueFrom(this.http.post(entry.url, entry.body, { headers }));
      case 'PUT':
        return firstValueFrom(this.http.put(entry.url, entry.body, { headers }));
      case 'PATCH':
        return firstValueFrom(this.http.patch(entry.url, entry.body, { headers }));
      case 'DELETE':
        return firstValueFrom(this.http.delete(entry.url, { headers }));
      default:
        return Promise.reject(new Error(`Unsupported HTTP method: ${method}`));
    }
  }

  private async refreshQueueSize(): Promise<void> {
    const size = await this.getQueueSize();
    this.pendingCount.set(size);
  }
}
