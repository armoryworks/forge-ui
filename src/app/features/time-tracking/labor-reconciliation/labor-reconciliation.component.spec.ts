import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LaborReconciliationComponent } from './labor-reconciliation.component';
import { TimeTrackingService } from '../services/time-tracking.service';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LaborRecomputeResult } from '../models/labor-recompute-result.model';

interface Internals {
  rows: () => { id: string; userName: string }[];
  preview: () => LaborRecomputeResult | null;
  canRecompute: () => boolean;
  runPreview(): void;
  apply(): void;
  hours(minutes: number | null): number | null;
  fromControl: { setValue(v: Date): void };
  toControl: { setValue(v: Date): void };
  load(): void;
}

describe('LaborReconciliationComponent', () => {
  const preview: LaborRecomputeResult = {
    applied: false, entriesChanged: 2, lockedSkipped: 1, laborMinutesBefore: 120, laborMinutesAfter: 40,
    costBefore: 72, costAfter: 24,
    jobs: [{ jobId: 9, jobNumber: 'J-9', entriesChanged: 2, laborMinutesBefore: 120, laborMinutesAfter: 40,
      laborCostBefore: 60, laborCostAfter: 20, burdenCostBefore: 12, burdenCostAfter: 4 }],
  };
  const service = {
    getLaborReconciliation: vi.fn((_from: string, _to: string) => of([{
      userId: 5, userName: 'Doe, Pat', date: '2026-10-21', paidMinutes: 480, jobLaborMinutes: 450, indirectMinutes: 0,
      manualMinutes: 0, unallocatedMinutes: 30, overlappingTimerMinutes: 70, longTimers: 0, runningTimers: 0,
    }])),
    recomputeLabor: vi.fn((request: { preview: boolean }) => of(request.preview ? preview : { ...preview, applied: true })),
  };
  let roles: string[] = [];
  let confirm = true;
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(confirm) })) };
  const snackbar = { success: vi.fn() };

  function create(): Internals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LaborReconciliationComponent],
      providers: [
        { provide: TimeTrackingService, useValue: service },
        { provide: AuthService, useValue: { hasAnyRole: (r: string[]) => r.some(x => roles.includes(x)) } },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: snackbar },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    TestBed.overrideComponent(LaborReconciliationComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(LaborReconciliationComponent);
    const c = fixture.componentInstance as unknown as Internals & { ngOnInit(): void };
    c.fromControl.setValue(new Date(2026, 9, 15));
    c.toControl.setValue(new Date(2026, 9, 21));
    c.ngOnInit();
    return c;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    roles = [];
    confirm = true;
  });

  it('loads paid time against job labor for the chosen days', () => {
    const c = create();
    expect(service.getLaborReconciliation).toHaveBeenCalledWith('2026-10-15', '2026-10-21');
    expect(c.rows()).toEqual([expect.objectContaining({ id: '5-2026-10-21', userName: 'Doe, Pat' })]);
    expect(c.hours(90)).toBe(1.5);
  });

  it('an office manager sees the report but cannot recompute', () => {
    roles = ['OfficeManager'];
    const c = create();
    expect(c.canRecompute()).toBe(false);
    c.runPreview();
    expect(service.recomputeLabor).not.toHaveBeenCalled();
  });

  it('a controller previews, then applies only after confirming', () => {
    roles = ['Controller'];
    const c = create();
    c.runPreview();
    expect(service.recomputeLabor).toHaveBeenCalledWith({ from: '2026-10-15', to: '2026-10-21', preview: true });
    expect(c.preview()?.entriesChanged).toBe(2);

    confirm = false;
    c.apply();
    expect(service.recomputeLabor).toHaveBeenCalledTimes(1);

    confirm = true;
    c.fromControl.setValue(new Date(2026, 8, 1));
    c.apply();
    expect(service.recomputeLabor).toHaveBeenLastCalledWith({ from: '2026-10-15', to: '2026-10-21', preview: false });
    expect(snackbar.success).toHaveBeenCalled();
    expect(c.preview()).toBeNull();
  });
});
