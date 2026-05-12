import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

export type ScanMode = 'move' | 'count' | 'receive' | 'issue' | 'ship' | 'inspect';

export interface KioskSession {
  userId: number;
  userName: string;
  userInitials: string;
  userColor: string;
  badgeId: string;
  mode: ScanMode | null;
  workflowState: Record<string, unknown> | null;
  lastActivity: Date;
  isForeground: boolean;
}

const DB_NAME = 'forge-kiosk-sessions';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const CHECK_INTERVAL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class KioskSessionService {
  private readonly destroyRef = inject(DestroyRef);

  readonly sessions = signal<KioskSession[]>([]);

  readonly foregroundSession = computed(() =>
    this.sessions().find(s => s.isForeground) ?? null,
  );

  readonly sessionCount = computed(() => this.sessions().length);

  readonly isTrainingMode = signal(false);

  private dbPromise: Promise<IDBDatabase> | null = null;
  private checkIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.restoreFromIndexedDb();
    this.startTimeoutChecker();
    this.destroyRef.onDestroy(() => this.dispose());
  }

  // ── Session Management ──

  activateSession(userId: number, userName: string, initials: string, color: string, badgeId: string): void {
    this.sessions.update(sessions => {
      const maxSessions = this.getConfig('kiosk:max_concurrent_sessions', 5);
      const existing = sessions.find(s => s.userId === userId);

      if (existing) {
        return sessions.map(s => ({
          ...s,
          isForeground: s.userId === userId,
          lastActivity: s.userId === userId ? new Date() : s.lastActivity,
        }));
      }

      let updated = sessions.map(s => ({ ...s, isForeground: false }));

      if (updated.length >= maxSessions) {
        const oldest = [...updated].sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime());
        updated = updated.filter(s => s.userId !== oldest[0].userId);
      }

      return [
        ...updated,
        {
          userId,
          userName,
          userInitials: initials,
          userColor: color,
          badgeId,
          mode: null,
          workflowState: null,
          lastActivity: new Date(),
          isForeground: true,
        },
      ];
    });

    this.persistToIndexedDb();
  }

  backgroundCurrentSession(): void {
    this.sessions.update(sessions =>
      sessions.map(s => s.isForeground ? { ...s, isForeground: false } : s),
    );
    this.persistToIndexedDb();
  }

  setMode(mode: ScanMode): void {
    this.sessions.update(sessions =>
      sessions.map(s => s.isForeground ? { ...s, mode, lastActivity: new Date() } : s),
    );
    this.persistToIndexedDb();
  }

  setWorkflowState(state: Record<string, unknown>): void {
    this.sessions.update(sessions =>
      sessions.map(s => s.isForeground ? { ...s, workflowState: state, lastActivity: new Date() } : s),
    );
    this.persistToIndexedDb();
  }

  clearMode(): void {
    this.sessions.update(sessions =>
      sessions.map(s => s.isForeground ? { ...s, mode: null, workflowState: null, lastActivity: new Date() } : s),
    );
    this.persistToIndexedDb();
  }

  removeSession(userId: number): void {
    this.sessions.update(sessions => sessions.filter(s => s.userId !== userId));
    this.persistToIndexedDb();
  }

  getSession(userId: number): KioskSession | undefined {
    return this.sessions().find(s => s.userId === userId);
  }

  enableTrainingMode(): void {
    this.isTrainingMode.set(true);
  }

  disableTrainingMode(): void {
    this.isTrainingMode.set(false);
  }

  // ── Timeout Management ──

  private startTimeoutChecker(): void {
    this.checkIntervalId = setInterval(() => this.checkTimeouts(), CHECK_INTERVAL_MS);
  }

  private checkTimeouts(): void {
    const timeoutMs = this.getConfig('kiosk:session_timeout_minutes', 5) * 60_000;
    const now = Date.now();

    this.sessions.update(sessions => {
      const active = sessions.filter(s => now - s.lastActivity.getTime() < timeoutMs);
      return active.length !== sessions.length ? active : sessions;
    });

    this.persistToIndexedDb();
  }

  // ── Configuration ──

  private getConfig(key: string, defaultValue: number): number {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const parsed = parseInt(stored, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  // ── IndexedDB Persistence ──

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private async persistToIndexedDb(): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const session of this.sessions()) {
        store.put({ ...session, lastActivity: session.lastActivity.toISOString() });
      }
    } catch {
      // IndexedDB unavailable — degrade gracefully
    }
  }

  private async restoreFromIndexedDb(): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as Array<KioskSession & { lastActivity: string }>;
        if (records.length > 0) {
          const restored = records.map(r => ({
            ...r,
            lastActivity: new Date(r.lastActivity),
          }));
          this.sessions.set(restored);
        }
      };
    } catch {
      // IndexedDB unavailable — start fresh
    }
  }

  // ── Cleanup ──

  private dispose(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }
}
