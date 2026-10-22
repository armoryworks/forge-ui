import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ClockOutSheetDialogComponent } from './clock-out-sheet-dialog.component';
import { ClockOutSheetData } from '../../models/clock-out-sheet-data.model';
import { KioskRunningTimer } from '../../models/kiosk-running-timer.model';

interface SheetInternals {
  rows: { timer: KioskRunningTimer; isStep: boolean; form: { patchValue(v: { good?: number | null; scrap?: number | null }): void } }[];
  clockOut(): void;
  cancel(): void;
}

function timer(id: number, jobId: number | null, operationId: number | null): KioskRunningTimer {
  return {
    timeEntryId: id, jobId, jobNumber: jobId ? `J-${jobId}` : null, jobOperationId: null, operationId,
    stepNumber: operationId ? 2 : null, operationTitle: operationId ? 'Turn' : null, entryType: 'Run',
    timerStart: '2026-10-22T13:00:00Z', attendancePercent: 100,
  };
}

function setup(data: ClockOutSheetData) {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ClockOutSheetDialogComponent()) as unknown as SheetInternals;
  return { component, close };
}

describe('ClockOutSheetDialogComponent', () => {
  it('lists one row per running timer, with piece fields only for steps, and blank means nothing recorded', () => {
    const { component, close } = setup({ workerName: 'Doe, Pat', timers: [timer(1, 41, 401), timer(2, 42, 408), timer(3, null, null)] });

    expect(component.rows.map(r => r.isStep)).toEqual([true, true, false]);
    component.rows[0].form.patchValue({ good: 6, scrap: 1 });
    component.rows[1].form.patchValue({ good: 0, scrap: null });
    component.clockOut();

    expect(close).toHaveBeenCalledWith([
      expect.objectContaining({ goodQuantity: 6, scrapQuantity: 1 }),
      expect.objectContaining({ goodQuantity: null, scrapQuantity: null }),
      expect.objectContaining({ goodQuantity: null, scrapQuantity: null }),
    ]);
  });

  it('cancel closes without clocking out', () => {
    const { component, close } = setup({ workerName: 'Doe, Pat', timers: [timer(1, 41, 401)] });
    component.cancel();
    expect(close).toHaveBeenCalledWith(undefined);
  });
});
