import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';

import { Shift, WorkCenter } from '../../models/scheduling.model';
import { ShiftDialogComponent, ShiftDialogData } from './shift-dialog.component';
import { daysToFlags, flagsToDays } from './shift-days.const';

interface DialogInternals {
  form: { controls: Record<string, { value: unknown; setValue(v: unknown): void }>; invalid: boolean; hasError(code: string): boolean };
  workCenters: { length: number; at(i: number): { controls: Record<string, { setValue(v: unknown): void; value: unknown }> } };
  addWorkCenter(): void;
  removeWorkCenter(i: number): void;
  save(): void;
}

const wc = (id: number, isActive = true): WorkCenter => ({
  id, name: `WC ${id}`, code: `W${id}`, description: null, dailyCapacityHours: 8, efficiencyPercent: 100, numberOfMachines: 1,
  laborCostPerHour: 0, burdenRatePerHour: 0, isActive, assetId: null, assetName: null, companyLocationId: null, locationName: null,
  sortOrder: 0, teamId: null, teamName: null,
});

describe('ShiftDialogComponent', () => {
  const close = vi.fn();

  function build(data: ShiftDialogData): DialogInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    return TestBed.runInInjectionContext(() => new ShiftDialogComponent()) as unknown as DialogInternals;
  }

  beforeEach(() => close.mockReset());

  it('maps days to the API flags and back', () => {
    expect(daysToFlags([1, 2, 4, 8, 16])).toBe(31);
    expect(flagsToDays(96)).toEqual([32, 64]);
  });

  it('creates a shift on weekday work centers', () => {
    const dialog = build({ workCenters: [wc(2), wc(3)] });
    dialog.form.controls['name'].setValue(' Night ');
    dialog.form.controls['startTime'].setValue('22:00');
    dialog.form.controls['endTime'].setValue('06:00');
    dialog.addWorkCenter();
    dialog.workCenters.at(0).controls['workCenterId'].setValue(2);

    dialog.save();

    expect(close).toHaveBeenCalledWith({
      name: 'Night', startTime: '22:00:00', endTime: '06:00:00', breakMinutes: 30, isActive: true,
      workCenters: [{ workCenterId: 2, daysOfWeek: 31 }],
    });
  });

  it('refuses a break as long as the shift and a work center listed twice', () => {
    const dialog = build({ workCenters: [wc(2)] });
    dialog.form.controls['name'].setValue('Day');
    dialog.form.controls['startTime'].setValue('08:00');
    dialog.form.controls['endTime'].setValue('09:00');
    dialog.form.controls['breakMinutes'].setValue(60);
    expect(dialog.form.hasError('breakMinutes')).toBe(true);

    dialog.form.controls['breakMinutes'].setValue(15);
    dialog.addWorkCenter();
    dialog.addWorkCenter();
    dialog.workCenters.at(0).controls['workCenterId'].setValue(2);
    dialog.workCenters.at(1).controls['workCenterId'].setValue(2);
    expect(dialog.form.invalid).toBe(true);

    dialog.removeWorkCenter(1);
    expect(dialog.form.invalid).toBe(false);
  });

  it('loads an existing shift for editing and can deactivate it', () => {
    const shift: Shift = {
      id: 5, name: 'Day', startTime: '07:00:00', endTime: '15:30:00', breakMinutes: 30, netHours: 8, isActive: true,
      workCenters: [{ workCenterId: 3, daysOfWeek: 96, workCenterName: 'WC 3' }],
    };
    const dialog = build({ shift, workCenters: [wc(3, false)] });

    expect(dialog.form.controls['startTime'].value).toBe('07:00');
    expect(dialog.workCenters.at(0).controls['days'].value).toEqual([32, 64]);
    dialog.form.controls['isActive'].setValue(false);
    dialog.save();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ isActive: false, workCenters: [{ workCenterId: 3, daysOfWeek: 96 }] }));
  });
});
