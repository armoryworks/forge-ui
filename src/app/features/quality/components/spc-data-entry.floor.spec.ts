import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { SpcDataEntryComponent } from './spc-data-entry.component';
import { SpcService } from '../services/spc.service';
import { SpcCharacteristic, SpcMeasurement } from '../models/spc.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';

interface EntryInternals {
  values: WritableSignal<(number | null)[]>;
  lastResult: () => SpcMeasurement | null;
  submit(): void;
}

describe('SpcDataEntryComponent · on the floor', () => {
  let recordMeasurements: ReturnType<typeof vi.fn>;

  function setup(measurement: Partial<SpcMeasurement>): EntryInternals {
    recordMeasurements = vi.fn(() => of([{ subgroupNumber: 12, isOutOfControl: false, isOutOfSpec: false, oocRuleViolated: null, ...measurement }]));
    TestBed.configureTestingModule({
      providers: [
        { provide: SpcService, useValue: { recordMeasurements } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new SpcDataEntryComponent());
    mockSignalInputs(component, { characteristic: { id: 4, sampleSize: 2, decimalPlaces: 3 } as SpcCharacteristic, jobId: 77 });
    const entry = component as unknown as EntryInternals;
    entry.values.set([1.001, 1.002]);
    return entry;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('records against the job it was opened for', () => {
    const entry = setup({});

    entry.submit();

    expect(recordMeasurements).toHaveBeenCalledWith(expect.objectContaining({ characteristicId: 4, jobId: 77 }));
    expect(entry.lastResult()?.isOutOfControl).toBe(false);
  });

  it('keeps the out-of-control result on screen', () => {
    const entry = setup({ isOutOfControl: true, oocRuleViolated: 'Rule 1' });

    entry.submit();

    expect(entry.lastResult()).toEqual(expect.objectContaining({ isOutOfControl: true, oocRuleViolated: 'Rule 1' }));
  });
});
