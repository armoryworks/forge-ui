import * as fs from 'fs';
import * as path from 'path';

import { rollOrderFate } from './outcome';
import type { StorylineState, StorylineStage } from './storyline.types';
import { isTerminal } from './storyline.types';

/**
 * Persistent storyline ledger for the narrative simulation.
 *
 * Unlike the stateless weekly backfill, the narrative engine must remember each
 * order's assigned fate and how far along it is. The ledger holds that in memory
 * across the week-by-week run and flushes to JSON after every week so a run is
 * inspectable and resumable. Keyed by a monotonic storyline id.
 */
const LEDGER_PATH = path.join(__dirname, '..', '..', 'playwright-report', 'narrative-ledger.json');

interface LedgerFile {
  nextId: number;
  runSalt: number;
  storylines: StorylineState[];
}

export class NarrativeLedger {
  private byId = new Map<number, StorylineState>();
  private nextId = 1;
  private runSalt: number;

  private constructor(runSalt: number) {
    this.runSalt = runSalt;
  }

  /** Loads the ledger from disk, or starts a fresh one salted by `runSalt`. */
  static load(runSalt: number): NarrativeLedger {
    const ledger = new NarrativeLedger(runSalt);
    try {
      if (fs.existsSync(LEDGER_PATH)) {
        const data = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8')) as LedgerFile;
        ledger.nextId = data.nextId ?? 1;
        ledger.runSalt = data.runSalt ?? runSalt;
        for (const s of data.storylines ?? []) ledger.byId.set(s.id, s);
      }
    } catch {
      // Corrupt/partial ledger → start clean; the corpus is regenerable.
    }
    return ledger;
  }

  save(): void {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data: LedgerFile = {
      nextId: this.nextId,
      runSalt: this.runSalt,
      storylines: [...this.byId.values()],
    };
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 1));
  }

  /** Spawns a new storyline with a deterministic fate; not yet acted on in the app. */
  spawn(companyName: string, weekIndex: number): StorylineState {
    const id = this.nextId++;
    const seed = (id * 2654435761 + this.runSalt) >>> 0;
    const state: StorylineState = {
      id,
      seed,
      fate: rollOrderFate(seed),
      stage: 'new',
      refs: {},
      companyName,
      createdWeek: weekIndex,
      lastAdvancedWeek: weekIndex,
    };
    this.byId.set(id, state);
    return state;
  }

  /** All non-terminal storylines, oldest first (so long-running deals get attention). */
  active(): StorylineState[] {
    return [...this.byId.values()]
      .filter(s => !isTerminal(s))
      .sort((a, b) => a.createdWeek - b.createdWeek);
  }

  counts(): Record<StorylineStage | 'total', number> {
    const acc = { total: 0 } as Record<string, number>;
    for (const s of this.byId.values()) {
      acc.total++;
      acc[s.stage] = (acc[s.stage] ?? 0) + 1;
    }
    return acc as Record<StorylineStage | 'total', number>;
  }
}
