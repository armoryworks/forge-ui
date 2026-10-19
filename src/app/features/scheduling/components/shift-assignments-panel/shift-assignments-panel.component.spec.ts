import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ShiftAssignmentsPanelComponent } from './shift-assignments-panel.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { TimeTrackingService } from '../../../time-tracking/services/time-tracking.service';
import { ShiftAssignment } from '../../../time-tracking/models/shift-assignment.model';
import { SchedulingService } from '../../services/scheduling.service';

interface PanelApi {
  canEdit: () => boolean;
  columns: () => ColumnDef[];
  assignments: () => ShiftAssignment[];
  userOptions: () => { value: unknown; label: string }[];
  shiftOptions: () => { value: unknown; label: string }[];
  form: { patchValue(value: Record<string, unknown>): void; invalid: boolean };
  ngOnInit(): void;
  openAssign(): void;
  save(): void;
  remove(row: ShiftAssignment): void;
}

const second: ShiftAssignment = {
  id: 4, userId: 18, userName: 'Asante, Kofi', shiftId: 2, shiftName: '2nd',
  effectiveFrom: '2026-10-19', effectiveTo: null, shiftDifferentialRate: 1.25, notes: null,
};

describe('ShiftAssignmentsPanelComponent', () => {
  let timeTracking: {
    getShiftAssignments: ReturnType<typeof vi.fn>;
    createShiftAssignment: ReturnType<typeof vi.fn>;
    deleteShiftAssignment: ReturnType<typeof vi.fn>;
  };
  let confirm: boolean;

  function create(roles: string[]): PanelApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TimeTrackingService, useValue: timeTracking },
        { provide: SchedulingService, useValue: { getUsers: () => of([{ id: 18, name: 'Asante, Kofi' }]) } },
        { provide: AuthService, useValue: { hasRole: (r: string) => roles.includes(r) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirm) }) } },
      ],
    });
    TestBed.overrideComponent(ShiftAssignmentsPanelComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(ShiftAssignmentsPanelComponent);
    fixture.componentRef.setInput('shifts', [
      { id: 1, name: '1st', startTime: '06:00', endTime: '14:30', breakMinutes: 30, netHours: 8, isActive: true },
      { id: 2, name: '2nd', startTime: '14:30', endTime: '23:00', breakMinutes: 30, netHours: 8, isActive: true },
      { id: 3, name: 'Old', startTime: '22:00', endTime: '06:00', breakMinutes: 30, netHours: 7.5, isActive: false },
    ]);
    const api = fixture.componentInstance as unknown as PanelApi;
    api.ngOnInit();
    return api;
  }

  beforeEach(() => {
    confirm = true;
    timeTracking = {
      getShiftAssignments: vi.fn(() => of([second])),
      createShiftAssignment: vi.fn(() => of(second)),
      deleteShiftAssignment: vi.fn(() => of(undefined)),
    };
  });

  it('lists who works each shift for a manager without offering changes the API refuses', () => {
    const api = create(['Manager']);

    expect(api.assignments()).toEqual([second]);
    expect(api.canEdit()).toBe(false);
    expect(api.columns().some(c => c.field === 'actions')).toBe(false);
  });

  it('lets an administrator assign a person to an active shift with date-only dates', () => {
    const api = create(['Admin']);
    api.openAssign();

    expect(api.userOptions()).toEqual([{ value: 18, label: 'Asante, Kofi' }]);
    expect(api.shiftOptions().map(o => o.label)).toEqual(['1st', '2nd']);

    api.form.patchValue({ userId: 18, shiftId: 2, effectiveFrom: new Date(2026, 9, 19), shiftDifferentialRate: 1.25, notes: ' second shift ' });
    api.save();

    expect(timeTracking.createShiftAssignment).toHaveBeenCalledWith({
      userId: 18, shiftId: 2, effectiveFrom: '2026-10-19', effectiveTo: undefined, shiftDifferentialRate: 1.25, notes: 'second shift',
    });
    expect(timeTracking.getShiftAssignments).toHaveBeenCalledTimes(2);
  });

  it('does not save without a person and a shift', () => {
    const api = create(['Admin']);
    api.openAssign();

    api.save();

    expect(api.form.invalid).toBe(true);
    expect(timeTracking.createShiftAssignment).not.toHaveBeenCalled();
  });

  it('removes an assignment only after the administrator confirms', () => {
    const api = create(['Admin']);
    confirm = false;
    api.remove(second);
    expect(timeTracking.deleteShiftAssignment).not.toHaveBeenCalled();

    confirm = true;
    api.remove(second);
    expect(timeTracking.deleteShiftAssignment).toHaveBeenCalledWith(4);
  });
});
