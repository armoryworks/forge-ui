import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WritableSignal } from '@angular/core';
import { ComponentFixtureAutoDetect, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { SpcDataEntryComponent } from './spc-data-entry.component';
import { SpcService } from '../services/spc.service';
import { SpcCharacteristic } from '../models/spc.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';

interface EntryInternals {
  values: WritableSignal<(number | null)[]>;
  submit(): void;
}

describe('SpcDataEntryComponent · submit', () => {
  let recordMeasurements: ReturnType<typeof vi.fn>;
  let entry: EntryInternals;

  beforeEach(() => {
    TestBed.resetTestingModule();
    recordMeasurements = vi.fn(() => new Subject());
    TestBed.configureTestingModule({
      providers: [
        { provide: ComponentFixtureAutoDetect, useValue: false },
        { provide: SpcService, useValue: { recordMeasurements } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const fixture = TestBed.createComponent(SpcDataEntryComponent);
    fixture.componentRef.setInput('characteristic', { id: 4, sampleSize: 2, decimalPlaces: 3 } as SpcCharacteristic);
    entry = fixture.componentInstance as unknown as EntryInternals;
    entry.values.set([1.001, 1.002]);
  });

  it('records one subgroup when Enter is pressed twice before the server answers', () => {
    entry.submit();
    entry.submit();

    expect(recordMeasurements).toHaveBeenCalledTimes(1);
  });
});
