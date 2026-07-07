import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { TrainingComponent } from './training.component';
import { TrainingService } from '../../services/training.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TrainingScenario } from '../../models/accounting.models';

const SCENARIOS: TrainingScenario[] = [
  { id: 's1', track: 'both', order: 10, titleKey: 't1', briefKey: 'b1', baitKey: null, hintKeys: ['h1'], validators: [{ type: 'trialBalanced' }], successKey: 'ok1' },
  { id: 's2', track: 'B', order: 20, titleKey: 't2', briefKey: 'b2', baitKey: 'bait2', hintKeys: [], validators: [{ type: 'entryReversed' }], successKey: 'ok2' },
];

interface Api {
  ngOnInit(): void;
  track(): 'A' | 'B' | null;
  chooseTrack(t: 'A' | 'B'): void;
  trackScenarios(): TrainingScenario[];
  passedIds(): Set<string>;
  check(s: TrainingScenario): void;
  reset(): void;
  state(): { entryCount: number } | null;
}

describe('TrainingComponent', () => {
  const svc = { getState: vi.fn(), getScenarios: vi.fn(), check: vi.fn(), reset: vi.fn() };
  const snackbar = { success: vi.fn(), error: vi.fn() };
  const dialog = { open: vi.fn() };

  function create(): Api {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TrainingService, useValue: svc },
        { provide: SnackbarService, useValue: snackbar },
        { provide: MatDialog, useValue: dialog },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    TestBed.overrideComponent(TrainingComponent, { set: { template: '', imports: [], styles: [] } });
    const api = TestBed.createComponent(TrainingComponent).componentInstance as unknown as Api;
    api.ngOnInit();
    return api;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    svc.getState.mockReturnValue(of({ seeded: true, bookId: 42, entryCount: 30 }));
    svc.getScenarios.mockReturnValue(of(SCENARIOS));
    svc.check.mockReturnValue(of({ scenarioId: 's1', passed: true, validators: [{ type: 'trialBalanced', passed: true }] }));
    svc.reset.mockReturnValue(of({ seeded: true, bookId: 42, entryCount: 30 }));
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
  });

  it('loads state + scenarios and starts with no track (intake)', () => {
    const api = create();
    expect(api.state()?.entryCount).toBe(30);
    expect(api.track()).toBeNull();
  });

  it('Track A hides B-only scenarios; Track B shows them', () => {
    const api = create();
    api.chooseTrack('A');
    expect(api.trackScenarios().map((s) => s.id)).toEqual(['s1']);
    api.chooseTrack('B');
    expect(api.trackScenarios().map((s) => s.id)).toEqual(['s1', 's2']);
    expect(localStorage.getItem('forge-training-track')).toBe('B');
  });

  it('a passing check records the scenario and persists it', () => {
    const api = create();
    api.chooseTrack('A');
    api.check(SCENARIOS[0]);
    expect(api.passedIds().has('s1')).toBe(true);
    expect(JSON.parse(localStorage.getItem('forge-training-passed')!)).toEqual(['s1']);
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('reset reseeds and clears progress after confirmation', () => {
    const api = create();
    api.chooseTrack('A');
    api.check(SCENARIOS[0]);
    api.reset();
    expect(svc.reset).toHaveBeenCalled();
    expect(api.passedIds().size).toBe(0);
    expect(localStorage.getItem('forge-training-passed')).toBeNull();
  });
});
