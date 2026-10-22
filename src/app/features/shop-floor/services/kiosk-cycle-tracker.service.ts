import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'forge-kiosk-cycle-baselines';
const KEEP_MS = 4 * 24 * 60 * 60 * 1000;

interface CycleBaseline {
  cycle: number;
  seenAt: number;
}

@Injectable({ providedIn: 'root' })
export class KioskCycleTrackerService {
  private readonly state = signal<ReadonlyMap<number, CycleBaseline>>(readStored());

  readonly baselines = computed<ReadonlyMap<number, number>>(() =>
    new Map([...this.state()].map(([id, baseline]) => [id, baseline.cycle])));

  seed(entries: readonly { timerId: number; cycle: number }[], now: number): void {
    const known = this.state();
    const fresh = entries.filter(entry => !known.has(entry.timerId));
    if (fresh.length === 0) return;
    const next = new Map([...known].filter(([, baseline]) => now - baseline.seenAt < KEEP_MS));
    for (const entry of fresh) next.set(entry.timerId, { cycle: entry.cycle, seenAt: now });
    this.commit(next);
  }

  advance(timerId: number, cycles: number): void {
    const current = this.state().get(timerId);
    if (!current || cycles <= 0) return;
    this.commit(new Map(this.state()).set(timerId, { ...current, cycle: current.cycle + cycles }));
  }

  private commit(next: Map<number, CycleBaseline>): void {
    this.state.set(next);
    writeStored(next);
  }
}

function writeStored(baselines: Map<number, CycleBaseline>): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(baselines)));
    return true;
  } catch {
    return false;
  }
}

function readStored(): Map<number, CycleBaseline> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, Partial<CycleBaseline>>;
    return new Map(Object.entries(parsed)
      .filter(([id, value]) => Number.isInteger(Number(id))
        && Number.isFinite(value?.cycle) && Number.isFinite(value?.seenAt))
      .map(([id, value]) => [Number(id), { cycle: value.cycle!, seenAt: value.seenAt! }]));
  } catch {
    return new Map();
  }
}
