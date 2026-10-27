import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AbcClassificationService } from '../../services/abc-classification.service';
import { AbcClassificationResult } from '../../models/abc-classification-result.model';
import { AbcClassificationRun } from '../../models/abc-classification-run.model';
import { AbcClassificationComponent } from './abc-classification.component';

interface AbcInternals {
  form: FormGroup<{ lookbackMonths: FormControl<number | null>; classAThresholdPercent: FormControl<number | null>; classBThresholdPercent: FormControl<number | null> }>;
  changesOnly: FormControl<boolean>;
  thresholdsOutOfOrder(): boolean;
  run(): void;
  apply(): void;
  results(): AbcClassificationResult[];
  visibleResults(): AbcClassificationResult[];
  changedCount(): number;
  activeRunApplied(): boolean;
  resultRowClass(row: unknown): string;
}

const RUN: AbcClassificationRun = {
  id: 4, runDate: '2026-10-26T15:00:00Z', totalParts: 2, classACount: 1, classBCount: 0, classCCount: 1,
  classAThresholdPercent: 80, classBThresholdPercent: 95, totalAnnualUsageValue: 1000, lookbackMonths: 12,
};
const RESULTS: AbcClassificationResult[] = [
  { partId: 1, partNumber: 'P-1', partDescription: 'Gear', classification: 'A', currentClassification: 'C', annualUsageValue: 900, annualDemandQuantity: 90, unitCost: 10, cumulativePercent: 90, rank: 1 },
  { partId: 2, partNumber: 'P-2', partDescription: 'Pin', classification: 'C', currentClassification: 'C', annualUsageValue: 100, annualDemandQuantity: 100, unitCost: 1, cumulativePercent: 100, rank: 2 },
];

describe('AbcClassificationComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;

  function setup() {
    service = {
      getRuns: vi.fn(() => of([RUN])),
      run: vi.fn(() => of(RUN)),
      getResults: vi.fn(() => of(RESULTS)),
      apply: vi.fn(() => of(undefined)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AbcClassificationService, useValue: service },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new AbcClassificationComponent()) as unknown as AbcInternals;
  }

  beforeEach(() => vi.restoreAllMocks());

  it('runs with the parameters and previews the proposed classes against the current ones', () => {
    const c = setup();
    c.form.patchValue({ lookbackMonths: 6, classAThresholdPercent: 70, classBThresholdPercent: 90 });

    c.run();

    expect(service['run']).toHaveBeenCalledWith({ lookbackMonths: 6, classAThresholdPercent: 70, classBThresholdPercent: 90 });
    expect(service['getResults']).toHaveBeenCalledWith(4);
    expect(c.changedCount()).toBe(1);
    expect(c.resultRowClass(RESULTS[0])).toBe('abc-row--changed');
    expect(c.resultRowClass(RESULTS[1])).toBe('');
    c.changesOnly.setValue(true);
    expect(c.visibleResults().map(r => r.partId)).toEqual([1]);
  });

  it('does not run when class B is not above class A', () => {
    const c = setup();
    c.form.patchValue({ classAThresholdPercent: 90, classBThresholdPercent: 80 });

    expect(c.thresholdsOutOfOrder()).toBe(true);
    c.run();
    expect(service['run']).not.toHaveBeenCalled();
  });

  it('applies the run and marks every part as now matching', () => {
    const c = setup();
    c.run();

    c.apply();

    expect(service['apply']).toHaveBeenCalledWith(4);
    expect(c.activeRunApplied()).toBe(true);
    expect(c.changedCount()).toBe(0);
  });
});
