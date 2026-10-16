import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartStandardCostRollComponent } from './part-standard-cost-roll.component';
import { PartsService } from '../../services/parts.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { RecalculatedStandardCost } from '../../models/recalculated-standard-cost.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const ROLL: RecalculatedStandardCost = {
  partId: 7, material: 12, labor: 5, overhead: 3, total: 20, costCalculationId: 41,
};

type RollInternals = {
  canRoll: boolean;
  result: () => RecalculatedStandardCost | null;
  rolling: () => boolean;
  recalculate: () => void;
  rolled: { emit: (v: RecalculatedStandardCost) => void };
};

describe('PartStandardCostRollComponent', () => {
  let recalc: ReturnType<typeof vi.fn>;
  let snackbar: { success: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };

  function create(roles: string[]): RollInternals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartsService, useValue: { recalculateStandardCost: recalc } },
        { provide: AuthService, useValue: { hasAnyRole: (allowed: string[]) => allowed.some((r) => roles.includes(r)) } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PartStandardCostRollComponent());
    mockSignalInputs(component, { partId: 7 });
    return component as unknown as RollInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    recalc = vi.fn(() => of(ROLL));
    snackbar = { success: vi.fn(), errorFrom: vi.fn() };
  });

  it('is offered to engineers and hidden from production workers', () => {
    expect(create(['Engineer']).canRoll).toBe(true);
    TestBed.resetTestingModule();
    expect(create(['ProductionWorker']).canRoll).toBe(false);
  });

  it('posts the roll for the bound part, shows the split and tells the parent', () => {
    const c = create(['Engineer']);
    const emitted: RecalculatedStandardCost[] = [];
    c.rolled.emit = (v) => emitted.push(v);

    c.recalculate();

    expect(recalc).toHaveBeenCalledWith(7);
    expect(c.result()).toEqual(ROLL);
    expect(c.rolling()).toBe(false);
    expect(emitted).toEqual([ROLL]);
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('reports a failed roll and keeps no result', () => {
    recalc = vi.fn(() => throwError(() => new Error('boom')));
    const c = create(['Manager']);

    c.recalculate();

    expect(c.result()).toBeNull();
    expect(c.rolling()).toBe(false);
    expect(snackbar.errorFrom).toHaveBeenCalledWith(expect.any(Error), 'parts.standardCost.rollFailed');
  });
});
