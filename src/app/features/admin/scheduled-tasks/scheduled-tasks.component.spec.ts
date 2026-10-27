import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AdminService } from '../services/admin.service';
import { ScheduledTask } from '../models/scheduled-task.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ReferenceDataService } from '../../../shared/services/reference-data.service';
import { CronScheduleFormGroup } from '../../../shared/utils/cron-schedule-form';
import { ScheduledTasksComponent } from './scheduled-tasks.component';

const TASK: ScheduledTask = {
  id: 7, name: 'Weekly mold PM', description: null, trackTypeId: 2, trackTypeName: 'Maintenance',
  internalProjectTypeId: null, assigneeId: 11, cronExpression: '0 7 * * 1', isActive: true,
  lastRunAt: null, nextRunAt: new Date('2026-11-02T14:00:00Z'), createdAt: new Date('2026-10-01T00:00:00Z'),
};

interface Internals {
  form: FormGroup;
  scheduleForm: CronScheduleFormGroup;
  tasks(): ScheduledTask[];
  trackTypeOptions(): { value: unknown }[];
  openCreate(): void;
  openEdit(row: ScheduledTask): void;
  save(): void;
  runNow(row: ScheduledTask): void;
  toggleActive(row: ScheduledTask): void;
  scheduleText(row: ScheduledTask): string;
}

function setup() {
  const admin = {
    getScheduledTasks: vi.fn(() => of([TASK])),
    getTrackTypes: vi.fn(() => of([{ id: 2, name: 'Maintenance' }])),
    getPeople: vi.fn(() => of([{ id: 11, firstName: 'Lena', lastName: 'Ortiz', isActive: true }])),
    createScheduledTask: vi.fn(() => of(TASK)),
    updateScheduledTask: vi.fn(() => of(TASK)),
    deleteScheduledTask: vi.fn(() => of(undefined)),
    runScheduledTask: vi.fn(() => of({ jobId: 301 })),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminService, useValue: admin },
      { provide: ReferenceDataService, useValue: { getByGroup: vi.fn(() => of([])) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScheduledTasksComponent()) as unknown as Internals;
  return { component, admin };
}

describe('ScheduledTasksComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists tasks with a plain-language schedule', () => {
    const { component } = setup();

    expect(component.tasks()).toEqual([TASK]);
    expect(component.trackTypeOptions()).toEqual([{ value: 2, label: 'Maintenance' }]);
    expect(component.scheduleText(TASK)).toBe('cronSchedule.describe.weekly');
  });

  it('creates a task with the cron built from the schedule fields', () => {
    const { component, admin } = setup();

    component.openCreate();
    component.form.patchValue({ name: 'Daily walk', trackTypeId: 2 });
    component.scheduleForm.patchValue({ frequency: 'daily', time: '06:30' });
    component.save();

    expect(admin.createScheduledTask).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Daily walk', trackTypeId: 2, cronExpression: '30 6 * * *',
    }));
  });

  it('loads an existing schedule into the editor and saves with PUT', () => {
    const { component, admin } = setup();

    component.openEdit(TASK);
    expect(component.scheduleForm.getRawValue()).toMatchObject({ frequency: 'weekly', dayOfWeek: 1, time: '07:00' });
    component.scheduleForm.patchValue({ dayOfWeek: 5 });
    component.save();

    expect(admin.updateScheduledTask).toHaveBeenCalledWith(7, expect.objectContaining({ cronExpression: '0 7 * * 5', isActive: true }));
  });

  it('runs a task now and pauses it', () => {
    const { component, admin } = setup();

    component.runNow(TASK);
    component.toggleActive(TASK);

    expect(admin.runScheduledTask).toHaveBeenCalledWith(7);
    expect(admin.updateScheduledTask).toHaveBeenCalledWith(7, { isActive: false });
  });
});
