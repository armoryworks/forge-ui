import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DrainResult, OfflineQueueEntry } from '../models/offline-queue-entry.model';
import { RejectedQueueEntry } from '../models/rejected-queue-entry.model';
import { SyncConflict } from '../models/sync-conflict.model';
import { SyncResult } from '../models/sync-result.model';
import { InstanceService } from './instance.service';

const DB_NAME = 'forge-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private readonly instances = inject(InstanceService);
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isDraining = false;

  readonly pendingCount = signal(0);
  /** @deprecated Use pendingCount instead */
  readonly queueSize = computed(() => this.pendingCount());
  readonly syncing = signal(false);
  readonly lastSyncResult = signal<SyncResult | null>(null);
  readonly conflict = signal<SyncConflict | null>(null);
  /** Mobile shell: replays the server refused (4xx). Shown until dismissed; the fix happens on the desktop. */
  readonly rejected = signal<RejectedQueueEntry[]>([]);

  constructor() {
    window.addEventListener('online', () => {
      this.drain();
    });
    if (environment.mobileShell) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) this.drain();
      });
    }

    this.refreshQueueSize();
  }

  async enqueue(
    method: string, url: string, body?: unknown, description?: string,
    options?: { headers?: Record<string, string>; instanceId?: string | null },
  ): Promise<string> {
    const entry: OfflineQueueEntry = {
      id: crypto.randomUUID(),
      method,
      url,
      body: body ?? null,
      timestamp: Date.now(),
      description: description ?? `${method.toUpperCase()} ${url}`,
      headers: options?.headers,
      instanceId: options?.instanceId ?? null,
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
    return entry.id;
  }

  /** Drop a queued change before it replays — the undo for an offline action. */
  async remove(id: string): Promise<void> {
    await this.removeEntry(id);
    await this.refreshQueueSize();
  }

  /** Pending entries for the active instance, oldest first. */
  listPending(): Promise<OfflineQueueEntry[]> {
    return this.getAllEntries();
  }

  dismissRejected(id: string): void {
    this.rejected.update((list) => list.filter((r) => r.id !== id));
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
          if (environment.mobileShell && err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500) {
            this.rejected.update((list) => [...list, {
              id: entry.id,
              description: entry.description ?? `${entry.method.toUpperCase()} ${entry.url}`,
              status: err.status,
              message: err.error?.detail ?? err.error?.title ?? '',
              timestamp: entry.timestamp,
            }]);
            await this.removeEntry(entry.id);
            failed++;
            continue;
          }
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
        const activeInstance = environment.mobileShell ? (this.instances.instance()?.id ?? null) : null;
        const entries = (request.result as OfflineQueueEntry[])
          .filter((e) => !environment.mobileShell || (e.instanceId ?? null) === activeInstance)
          .sort((a, b) => a.timestamp - b.timestamp);
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
    const headers = { ...(entry.headers ?? {}), ...(force ? { 'X-Force-Overwrite': 'true' } : {}) };

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
