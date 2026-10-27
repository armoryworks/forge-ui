import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ReportBuilderService } from '../../services/report-builder.service';
import { ReportSchedule } from '../../models/report-schedule.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CronScheduleFormGroup } from '../../../../shared/utils/cron-schedule-form';
import { ReportSchedulesDialogComponent, parseRecipients } from './report-schedules-dialog.component';

const SCHEDULE: ReportSchedule = {
  id: 12, savedReportId: 3, reportName: 'Weekly jobs', cronExpression: '0 7 * * 1', recipientEmailsJson: '["lena@example.test"]',
  format: 'Csv', isActive: true, lastSentAt: null, nextRunAt: '2026-11-02T14:00:00Z', subjectTemplate: 'Weekly jobs',
  createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
};

interface Internals {
  form: FormGroup;
  scheduleForm: CronScheduleFormGroup;
  schedules(): ReportSchedule[];
  adding(): boolean;
  startAdding(): void;
  save(): void;
  runNow(row: ReportSchedule): void;
  remove(row: ReportSchedule): void;
  recipients(row: ReportSchedule): string;
}

function setup(existing: ReportSchedule[] = [SCHEDULE, { ...SCHEDULE, id: 13, savedReportId: 99 }]) {
  const service = {
    getSchedules: vi.fn(() => of(existing)),
    createSchedule: vi.fn(() => of(SCHEDULE)),
    runScheduleNow: vi.fn(() => of({ scheduleId: 12, recipientCount: 1 })),
    deleteSchedule: vi.fn(() => of(undefined)),
  };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: ReportBuilderService, useValue: service },
      { provide: SnackbarService, useValue: snackbar },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: { reportId: 3, reportName: 'Weekly jobs' } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ReportSchedulesDialogComponent()) as unknown as Internals;
  return { component, service, snackbar };
}

describe('ReportSchedulesDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists only the schedules of this report', () => {
    const { component } = setup();

    expect(component.schedules().map(s => s.id)).toEqual([12]);
    expect(component.recipients(SCHEDULE)).toBe('lena@example.test');
    expect(component.adding()).toBe(false);
  });

  it('opens the new-schedule form when the report has none', () => {
    const { component } = setup([]);

    expect(component.adding()).toBe(true);
  });

  it('creates a schedule from frequency, time, format and recipients', () => {
    const { component, service } = setup();

    component.startAdding();
    component.scheduleForm.patchValue({ frequency: 'daily', time: '06:00' });
    component.form.patchValue({ recipients: 'lena@example.test; marco@example.test, lena@example.test', format: 'Xlsx' });
    component.save();

    expect(service.createSchedule).toHaveBeenCalledWith({
      savedReportId: 3, cronExpression: '0 6 * * *', format: 'Xlsx', subjectTemplate: 'Weekly jobs',
      recipientEmailsJson: '["lena@example.test","marco@example.test"]',
    });
  });

  it('rejects a recipient that is not an e-mail address', () => {
    const { component } = setup();

    component.startAdding();
    component.form.patchValue({ recipients: 'lena@example.test, not-an-email' });

    expect(component.form.controls['recipients'].hasError('email')).toBe(true);
    expect(parseRecipients(' a@x.test ,b@x.test ')).toEqual(['a@x.test', 'b@x.test']);
  });

  it('sends now and deletes', () => {
    const { component, service } = setup();

    component.runNow(SCHEDULE);
    component.remove(SCHEDULE);

    expect(service.runScheduleNow).toHaveBeenCalledWith(12);
    expect(service.deleteSchedule).toHaveBeenCalledWith(12);
  });
});
