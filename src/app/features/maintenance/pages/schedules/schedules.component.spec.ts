import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SchedulesComponent } from './schedules.component';
import { MaintenanceSchedulesService } from '../../services/maintenance-schedules.service';
import { AssetsService } from '../../../assets/services/assets.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { DowntimeDialogComponent } from '../../../assets/components/downtime-dialog/downtime-dialog.component';
import { MaintenanceSchedule } from '../../models/maintenance-schedule.model';

interface SchedulesView {
  schedules: WritableSignal<MaintenanceSchedule[]>;
  loggingSchedule: WritableSignal<MaintenanceSchedule | null>;
  createForm: FormGroup;
  logForm: FormGroup;
  openCreate(): void;
  saveSchedule(): void;
  openLog(schedule: MaintenanceSchedule): void;
  saveLog(): void;
  createJob(schedule: MaintenanceSchedule): void;
  intervalParts(schedule: MaintenanceSchedule): string[];
  canReportDowntime: boolean;
  openMachineDown(): void;
}

const lube: MaintenanceSchedule = {
  id: 4, assetId: 9, assetName: 'VMC-01', title: 'Spindle lube', description: null,
  intervalDays: 90, intervalHours: 250, intervalShots: null,
  lastPerformedAt: null, nextDueAt: '2026-12-01T00:00:00Z', isActive: true, isOverdue: true,
};

describe('SchedulesComponent', () => {
  let service: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; logService: ReturnType<typeof vi.fn>; createJob: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let breakdownOn: boolean;
  let view: SchedulesView;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = {
      list: vi.fn(() => of([lube])),
      create: vi.fn(() => of(lube)),
      logService: vi.fn(() => of({})),
      createJob: vi.fn(() => of({ jobId: 12 })),
    };
    navigate = vi.fn();
    dialogOpen = vi.fn();
    breakdownOn = true;
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MaintenanceSchedulesService, useValue: service },
        { provide: AssetsService, useValue: { getAssets: vi.fn(() => of([{ id: 9, name: 'VMC-01' }])) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: Router, useValue: { navigate } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: CapabilityService, useValue: { isEnabled: vi.fn((code: string) => breakdownOn && code === 'CAP-MAINT-BREAKDOWN') } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new SchedulesComponent()) as unknown as SchedulesView;
  });

  it('loads every schedule on start', () => {
    expect(service.list).toHaveBeenCalled();
    expect(view.schedules()).toEqual([lube]);
  });

  it('sends usage intervals with a new schedule', () => {
    view.openCreate();
    view.createForm.setValue({
      assetId: 9, title: ' Mold PM ', description: '', intervalDays: 180,
      intervalHours: null, intervalShots: 50000, nextDueAt: new Date(2026, 10, 1),
    });

    view.saveSchedule();

    expect(service.create).toHaveBeenCalledWith({
      assetId: 9, title: 'Mold PM', description: undefined, intervalDays: 180,
      intervalHours: undefined, intervalShots: 50000, nextDueAt: '2026-11-01T00:00:00Z',
    });
  });

  it('does not save a schedule without an asset', () => {
    view.openCreate();
    view.createForm.patchValue({ title: 'Lube', nextDueAt: new Date(2026, 10, 1) });

    view.saveSchedule();

    expect(service.create).not.toHaveBeenCalled();
  });

  it('logs a service and leaves blank meter readings to the server', () => {
    view.openLog(lube);
    view.logForm.patchValue({ notes: ' Lubed ' });

    view.saveLog();

    expect(service.logService).toHaveBeenCalledWith(4, {
      hoursAtService: undefined, shotCountAtService: undefined, cost: undefined, notes: 'Lubed',
    });
    expect(view.loggingSchedule()).toBeNull();
  });

  it('opens the new maintenance job on the board', () => {
    view.createJob(lube);

    expect(service.createJob).toHaveBeenCalledWith(4);
    expect(navigate).toHaveBeenCalledWith(['/kanban'], { queryParams: { detail: 'job:12' } });
  });

  it('describes every interval the schedule uses', () => {
    expect(view.intervalParts({ ...lube, intervalShots: 50000 })).toHaveLength(3);
    expect(view.intervalParts({ ...lube, intervalHours: null })).toHaveLength(1);
  });
  it('opens the machine-down dialog with an asset picker', () => {
    expect(view.canReportDowntime).toBe(true);

    view.openMachineDown();

    expect(dialogOpen).toHaveBeenCalledWith(DowntimeDialogComponent, expect.objectContaining({ data: { asset: null } }));
  });

  it('hides machine down while breakdown maintenance is off', () => {
    breakdownOn = false;
    const hidden = TestBed.runInInjectionContext(() => new SchedulesComponent()) as unknown as SchedulesView;

    expect(hidden.canReportDowntime).toBe(false);
  });
});
