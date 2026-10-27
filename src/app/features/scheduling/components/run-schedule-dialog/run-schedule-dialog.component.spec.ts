import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { RunScheduleDialogComponent } from './run-schedule-dialog.component';

interface DialogApi {
  form: FormGroup;
  violations(): string[];
  confirm(): void;
  close(): void;
}

function setup() {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: MatDialogRef, useValue: { close } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const dialog = TestBed.runInInjectionContext(() => new RunScheduleDialogComponent()) as unknown as DialogApi;
  return { dialog, close };
}

describe('RunScheduleDialogComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 9, 30));
  });

  afterEach(() => vi.useRealTimers());

  it('defaults to a forward, due-date run from today for thirty days', () => {
    const { dialog, close } = setup();

    dialog.confirm();

    expect(close).toHaveBeenCalledWith({
      direction: 'Forward', scheduleFrom: '2026-10-26', scheduleTo: '2026-11-25', priorityRule: 'DueDate',
    });
  });

  it('sends the direction, range and priority rule the planner chose', () => {
    const { dialog, close } = setup();
    dialog.form.setValue({
      direction: 'Backward',
      scheduleFrom: new Date(2026, 10, 23),
      scheduleTo: new Date(2026, 11, 23),
      priorityRule: 'Priority',
    });

    dialog.confirm();

    expect(close).toHaveBeenCalledWith({
      direction: 'Backward', scheduleFrom: '2026-11-23', scheduleTo: '2026-12-23', priorityRule: 'Priority',
    });
  });

  it('refuses an end date before the start date', () => {
    const { dialog, close } = setup();
    dialog.form.patchValue({ scheduleFrom: new Date(2026, 10, 23), scheduleTo: new Date(2026, 10, 20) });

    dialog.confirm();

    expect(dialog.form.invalid).toBe(true);
    expect(dialog.violations()).toContain('scheduling.runDialog.toBeforeFrom');
    expect(close).not.toHaveBeenCalled();
  });

  it('closes without a request when cancelled', () => {
    const { dialog, close } = setup();

    dialog.close();

    expect(close).toHaveBeenCalledWith(undefined);
  });
});
