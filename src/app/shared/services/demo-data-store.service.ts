import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type Row = Record<string, unknown> & { id?: number | string };

/**
 * Demo-mode in-memory data store.
 *
 * Lazy-loads /demo-data/{file}.json on first access for an entity, then keeps
 * a mutable overlay so writes issued during the session appear to succeed.
 * Everything lives in RAM — a page refresh resets to the seeded snapshot.
 *
 * The interceptor is the only consumer; components/services don't know demo
 * mode exists.
 */
@Injectable({ providedIn: 'root' })
export class DemoDataStore {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Row[]>();
  private readonly inflight = new Map<string, Promise<Row[]>>();
  private nextId = 1_000_000;

  async load(file: string): Promise<Row[]> {
    const cached = this.cache.get(file);
    if (cached) return cached;

    const pending = this.inflight.get(file);
    if (pending) return pending;

    const promise = firstValueFrom(
      this.http.get<Row[]>(`/demo-data/${file}.json`),
    )
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        this.cache.set(file, arr);
        this.inflight.delete(file);
        return arr;
      })
      .catch(() => {
        // Missing file → treat as empty set rather than propagating a 404.
        const empty: Row[] = [];
        this.cache.set(file, empty);
        this.inflight.delete(file);
        return empty;
      });

    this.inflight.set(file, promise);
    return promise;
  }

  /** Synchronous lookup of already-loaded data; returns [] if not yet loaded. */
  peek(file: string): Row[] {
    return this.cache.get(file) ?? [];
  }

  /** Append a new row, assigning a synthetic id if none is provided. */
  append(file: string, row: Row): Row {
    const list = this.cache.get(file) ?? [];
    const stamped: Row = {
      ...row,
      id: row.id ?? this.nextId++,
      createdAt: row['createdAt'] ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    list.push(stamped);
    this.cache.set(file, list);
    return stamped;
  }

  /** Update a row by id, merging the patch. Returns merged row or null. */
  update(file: string, id: number | string, patch: Row): Row | null {
    const list = this.cache.get(file);
    if (!list) return null;
    const idx = list.findIndex(r => String(r.id) === String(id));
    if (idx === -1) return null;
    const merged: Row = { ...list[idx], ...patch, id: list[idx].id, updatedAt: new Date().toISOString() };
    list[idx] = merged;
    return merged;
  }

  /** Soft-remove (mark deleted). Returns true if a row was found. */
  remove(file: string, id: number | string): boolean {
    const list = this.cache.get(file);
    if (!list) return false;
    const idx = list.findIndex(r => String(r.id) === String(id));
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  }

  /** Allocate the next synthetic id without inserting anything. */
  allocateId(): number {
    return this.nextId++;
  }
}
