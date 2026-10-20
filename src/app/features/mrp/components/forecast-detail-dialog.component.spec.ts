import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MrpService } from '../services/mrp.service';
import { ForecastDetailDialogComponent } from './forecast-detail-dialog.component';

interface DetailApi {
  rows(): { isForecast: boolean; override: FormControl<number | null> | null }[];
  canApprove(): boolean;
  canApply(): boolean;
  scheduleControl: FormControl<number | null>;
  saveOverrides(): void;
  applyToSchedule(): void;
  approve(): void;
  close(): void;
}

const detail = (status: string) => ({
  id: 5, name: 'Q4', partNumber: 'FG-1', status, forecastStartDate: '2026-11-01T00:00:00Z',
  forecastBuckets: [
    { periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-11-01T00:00:00Z', forecastedQuantity: 0, historicalQuantity: 40, overrideQuantity: null },
    { periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z', forecastedQuantity: 50, historicalQuantity: null, overrideQuantity: null },
    { periodStart: '2026-12-01T00:00:00Z', periodEnd: '2027-01-01T00:00:00Z', forecastedQuantity: 55, historicalQuantity: null, overrideQuantity: 70 },
  ],
});

function setup(status: string) {
  const mrp = {
    getForecast: vi.fn(() => of(detail(status))),
    getMasterSchedules: vi.fn(() => of([{ id: 9, name: 'Draft MPS' }])),
    createForecastOverride: vi.fn(() => of({})),
    applyForecastToMps: vi.fn(() => of(undefined)),
  };
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { forecast: { id: 5, status } } },
      { provide: MrpService, useValue: mrp },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const dialog = TestBed.runInInjectionContext(() => new ForecastDetailDialogComponent()) as unknown as DetailApi;
  return { dialog, mrp, close };
}

describe('ForecastDetailDialogComponent', () => {
  it('loads the buckets and lets only forecast periods be overridden', () => {
    const { dialog, mrp } = setup('Draft');

    expect(mrp.getForecast).toHaveBeenCalledWith(5);
    expect(dialog.rows().map(r => r.isForecast)).toEqual([false, true, true]);
    expect(dialog.rows().map(r => (r.override === null ? 'none' : r.override.value))).toEqual(['none', null, 70]);
    expect(dialog.canApprove()).toBe(true);
    expect(dialog.canApply()).toBe(false);
  });

  it('saves only the overrides that were edited', () => {
    const { dialog, mrp } = setup('Draft');
    const control = dialog.rows()[1].override!;
    control.setValue(65);
    control.markAsDirty();

    dialog.saveOverrides();

    expect(mrp.createForecastOverride).toHaveBeenCalledTimes(1);
    expect(mrp.createForecastOverride).toHaveBeenCalledWith(5, '2026-11-01T00:00:00Z', 65);
  });

  it('hands approval back to the page so it confirms first', () => {
    const { dialog, close } = setup('Draft');

    dialog.approve();

    expect(close).toHaveBeenCalledWith('approve');
  });

  it('applies an approved forecast to the chosen draft schedule', () => {
    const { dialog, mrp, close } = setup('Approved');
    expect(dialog.canApply()).toBe(true);
    expect(mrp.getMasterSchedules).toHaveBeenCalledWith('Draft');

    dialog.scheduleControl.setValue(9);
    dialog.applyToSchedule();

    expect(mrp.applyForecastToMps).toHaveBeenCalledWith(5, 9);
    expect(close).toHaveBeenCalledWith('changed');
  });

  it('offers no overrides once applied', () => {
    const { dialog } = setup('Applied');

    expect(dialog.rows().every(r => r.override === null)).toBe(true);
  });
});
