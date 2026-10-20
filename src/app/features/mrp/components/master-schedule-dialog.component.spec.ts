import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { MasterScheduleDetail } from '../models/mrp.model';
import { MasterScheduleDialogComponent } from './master-schedule-dialog.component';

interface ScheduleDialogApi {
  lines: FormArray<FormGroup>;
  showPrefilledParts(pickers: { setSelected(id: number, text: string): void }[]): void;
}

const schedule = {
  id: 3, name: 'Q4', description: null, status: 'Draft', periodStart: '2026-10-01', periodEnd: '2026-12-31',
  lines: [
    { id: 11, masterScheduleId: 3, partId: 320, partNumber: 'FG-320', partDescription: null, quantity: 2000, dueDate: '2026-10-12', notes: null },
    { id: 12, masterScheduleId: 3, partId: 410, partNumber: 'FG-410', partDescription: null, quantity: 500, dueDate: '2026-10-19', notes: null },
  ],
} as unknown as MasterScheduleDetail;

function setup(): ScheduleDialogApi {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: { schedule } },
    ],
  });
  return TestBed.runInInjectionContext(() => new MasterScheduleDialogComponent()) as unknown as ScheduleDialogApi;
}

describe('MasterScheduleDialogComponent', () => {
  it('shows each existing line part number in its picker when editing', () => {
    const dialog = setup();
    const pickers = [{ setSelected: vi.fn() }, { setSelected: vi.fn() }];

    dialog.showPrefilledParts(pickers);

    expect(pickers[0].setSelected).toHaveBeenCalledWith(320, 'FG-320');
    expect(pickers[1].setSelected).toHaveBeenCalledWith(410, 'FG-410');
  });

  it('refuses a quantity with more than four decimals', () => {
    const quantity = setup().lines.at(0).controls['quantity'];

    quantity.setValue(12.34567);
    expect(quantity.invalid).toBe(true);

    quantity.setValue(12.3457);
    expect(quantity.valid).toBe(true);
  });

  describe('west of UTC', () => {
    let originalTz: string | undefined;

    beforeEach(() => {
      originalTz = process.env['TZ'];
      process.env['TZ'] = 'America/Denver';
    });

    afterEach(() => {
      if (originalTz === undefined) delete process.env['TZ'];
      else process.env['TZ'] = originalTz;
    });

    it('loads a UTC-midnight line due date on its own calendar day', () => {
      const due = setup().lines.at(0).controls['dueDate'].value as Date;

      expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2026, 9, 12]);
    });
  });
});
