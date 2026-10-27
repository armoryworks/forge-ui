import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, Subject, throwError } from 'rxjs';

import { TimeTrackingComponent } from './time-tracking.component';
import { TimeEntry } from './models/time-entry.model';
import { TimeTrackingService } from './services/time-tracking.service';
import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { RunningTimersService } from '../../shared/services/running-timers.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { TimerHubService } from '../../shared/services/timer-hub.service';
import { JobOperationsService } from '../../shared/services/job-operations.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PageInternals {
  activeTimer: () => TimeEntry | null;
  otherRunningTimers: () => TimeEntry[];
  stopTarget: () => TimeEntry | null;
  activeTimerElapsed: () => string;
  openStopTimer(entry?: TimeEntry | null): void;
  openStopTimerById(id: number): void;
  stopTimer(): void;
  entryForm: { patchValue(value: Record<string, unknown>): void; invalid: boolean };
  entryViolations: () => string[];
  dialogRef: { clearDraft(): void };
  openManualEntry(): void;
  saveEntry(): void;
  startTimer(): void;
  canChange(entry: TimeEntry): boolean;
  openStartTimer(): void;
  timerForm: { patchValue(value: Record<string, unknown>): void; controls: { jobId: { setValue(v: number | null): void } } };
  timerOperationOptions: () => { value: unknown }[];
  timerHasOperation: () => boolean;
}

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 1,
    jobId: 42,
    jobNumber: 'JOB-0042',
    userId: 1,
    userName: 'Rivera, Sam',
    date: new Date('2026-10-08T00:00:00Z'),
    durationMinutes: 0,
    category: 'Production',
    notes: null,
    timerStart: new Date('2026-10-08T08:00:00Z'),
    timerStop: null,
    isManual: false,
    isLocked: false,
    createdAt: new Date('2026-10-08T08:00:00Z'),
    jobOperationId: null,
    ...overrides,
  };
}

const jobOperations = {
  getOperations: vi.fn(() => of({ jobId: 42, operations: [
    { operationId: 11, stepNumber: 10, title: 'Mill', status: 'NotStarted' },
    { operationId: 12, stepNumber: 20, title: 'Deburr', status: 'Complete' },
  ] })),
  startTimer: vi.fn(() => of({})),
};

function setup(entries: TimeEntry[], mine: Observable<TimeEntry[]>, billableEnabled = false, roles: string[] = [], multiOp = true) {
  const service = {
    getTimeEntries: vi.fn().mockReturnValue(of(entries)),
    stopTimer: vi.fn().mockReturnValue(of({})),
    createTimeEntry: vi.fn().mockReturnValue(of({})),
    startTimer: vi.fn().mockReturnValue(of({})),
  };
  const running = { getMine: vi.fn().mockReturnValue(mine) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: TimeTrackingService, useValue: service },
      { provide: RunningTimersService, useValue: running },
      { provide: AuthService, useValue: { user: () => ({ id: 1 }), hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: TimerHubService, useValue: { connect: vi.fn().mockResolvedValue(undefined), onTimerStartedEvent: vi.fn(), onTimerStoppedEvent: vi.fn(), clearCallbacks: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: DraftResumeService, useValue: { consume: vi.fn().mockReturnValue(false) } },
      { provide: CapabilityService, useValue: { isEnabled: (code: string) => (code === 'CAP-MFG-MULTIOP' ? multiOp : billableEnabled && code === 'CAP-PS-TIME-BILLABLE') } },
      { provide: JobOperationsService, useValue: jobOperations },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new TimeTrackingComponent()) as unknown as PageInternals;
  return { component, service, running };
}

describe('TimeTrackingComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('keeps today\'s single Stop button for one job-level timer', () => {
    const general = entry({ id: 5 });
    const { component, service } = setup([general], of([general]));

    expect(component.activeTimer()?.id).toBe(5);
    expect(component.otherRunningTimers()).toEqual([]);

    component.openStopTimer();
    component.stopTimer();
    expect(service.stopTimer).toHaveBeenCalledWith({ timeEntryId: 5, notes: undefined });
  });

  it('lists operation timers beside the job-level one and stops the chosen entry', () => {
    const general = entry({ id: 5 });
    const operation = entry({ id: 6, jobOperationId: 3, operationStepNumber: 2, operationTitle: 'Mill' });
    const { component, service } = setup([], of([operation, general]));

    expect(component.activeTimer()?.id).toBe(5);
    expect(component.otherRunningTimers().map(t => t.id)).toEqual([6]);

    component.openStopTimerById(6);
    expect(component.stopTarget()?.id).toBe(6);
    component.stopTimer();
    expect(service.stopTimer).toHaveBeenCalledWith({ timeEntryId: 6, notes: undefined });
  });

  it('ignores other users\' open entries when the active-timer endpoint is unavailable', () => {
    const someoneElse = entry({ id: 7, userId: 2 });
    const { component } = setup([someoneElse], throwError(() => new Error('404')));

    expect(component.activeTimer()).toBeNull();
    expect(component.otherRunningTimers()).toEqual([]);
  });

  it('keeps the header elapsed time ticking after the first render', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T08:01:30Z'));
    try {
      const general = entry({ id: 5, timerStart: new Date('2026-10-08T08:00:00Z') });
      const { component } = setup([general], of([general]));

      expect(component.activeTimerElapsed()).toBe('1m');
      vi.advanceTimersByTime(3 * 60_000);
      expect(component.activeTimerElapsed()).toBe('4m');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the billable choice when billable time is turned on', () => {
    const { component, service } = setup([], of([]), true);
    component.dialogRef = { clearDraft: vi.fn() };

    component.openManualEntry();
    component.entryForm.patchValue({ hours: 0, minutes: 30, category: 'Meeting', isBillable: false });
    component.saveEntry();

    expect(service.createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 30, isBillable: false }));
  });

  it('leaves the billable flag to the server default when billable time is off', () => {
    const { component, service } = setup([], of([]));
    component.dialogRef = { clearDraft: vi.fn() };

    component.openManualEntry();
    component.entryForm.patchValue({ hours: 1, minutes: 0, isBillable: false });
    component.saveEntry();

    expect(service.createTimeEntry.mock.calls[0][0].isBillable).toBeUndefined();
  });

  it('refuses a manual entry whose total is zero or over a day', () => {
    const { component, service } = setup([], of([]));
    component.dialogRef = { clearDraft: vi.fn() };
    component.openManualEntry();

    component.entryForm.patchValue({ hours: 0, minutes: 0 });
    expect(component.entryForm.invalid).toBe(true);
    expect(component.entryViolations()).toContain('timeTracking.durationRange');

    component.entryForm.patchValue({ hours: 24, minutes: 59 });
    expect(component.entryForm.invalid).toBe(true);
    component.saveEntry();
    expect(service.createTimeEntry).not.toHaveBeenCalled();

    component.entryForm.patchValue({ hours: 24, minutes: 0 });
    expect(component.entryViolations()).not.toContain('timeTracking.durationRange');
  });

  it('starts one timer when Start is pressed twice before the server answers', () => {
    const { component, service } = setup([], of([]));
    service.startTimer.mockReturnValue(new Subject());

    component.startTimer();
    component.startTimer();

    expect(service.startTimer).toHaveBeenCalledTimes(1);
  });

  it('lets Start be retried after the server rejects the first press', () => {
    const { component, service } = setup([], of([]));
    service.startTimer.mockReturnValue(throwError(() => new Error('409')));

    component.startTimer();
    component.startTimer();

    expect(service.startTimer).toHaveBeenCalledTimes(2);
  });

  it('stops a timer once when Stop is pressed twice before the server answers', () => {
    const general = entry({ id: 5 });
    const { component, service } = setup([general], of([general]));
    service.stopTimer.mockReturnValue(new Subject());

    component.openStopTimer();
    component.stopTimer();
    component.stopTimer();

    expect(service.stopTimer).toHaveBeenCalledTimes(1);
  });

  it('logs one manual entry when Save fires twice before the server answers', () => {
    const { component, service } = setup([], of([]));
    service.createTimeEntry.mockReturnValue(new Subject());
    component.dialogRef = { clearDraft: vi.fn() };

    component.openManualEntry();
    component.entryForm.patchValue({ hours: 1, minutes: 0 });
    component.saveEntry();
    component.saveEntry();

    expect(service.createTimeEntry).toHaveBeenCalledTimes(1);
  });

  it('offers delete on another user\'s entry only to admins and managers', () => {
    const own = entry({ id: 8, userId: 1 });
    const coworker = entry({ id: 9, userId: 2 });

    for (const role of ['OfficeManager', 'Controller', 'ProductionWorker']) {
      const { component } = setup([own, coworker], of([]), false, [role]);
      expect(component.canChange(own)).toBe(true);
      expect(component.canChange(coworker)).toBe(false);
    }
    for (const role of ['Admin', 'Manager']) {
      const { component } = setup([own, coworker], of([]), false, [role]);
      expect(component.canChange(coworker)).toBe(true);
    }
  });

  it('starts a job-operation timer when a job and one of its open operations are picked', () => {
    jobOperations.startTimer.mockClear();
    const { component, service } = setup([], of([]));
    component.openStartTimer();
    component.timerForm.controls.jobId.setValue(42);

    expect(jobOperations.getOperations).toHaveBeenCalledWith(42);
    expect(component.timerOperationOptions().map(o => o.value)).toEqual([null, 11]);
    expect(component.timerHasOperation()).toBe(false);
    component.timerForm.patchValue({ operationId: 11, entryType: 'Setup' });
    expect(component.timerHasOperation()).toBe(true);
    component.startTimer();

    expect(jobOperations.startTimer).toHaveBeenCalledWith(42, 11, 'Setup');
    expect(service.startTimer).not.toHaveBeenCalled();

    component.timerForm.controls.jobId.setValue(43);
    expect(component.timerHasOperation()).toBe(false);
  });

  it('starts a job timer without an operation, and an overhead timer with only a category', () => {
    jobOperations.startTimer.mockClear();
    const { component, service } = setup([], of([]), false, [], false);
    component.openStartTimer();
    component.timerForm.patchValue({ jobId: 42, entryType: 'Rework', category: 'Meeting', notes: 'Fix burrs' });
    component.startTimer();
    expect(service.startTimer).toHaveBeenLastCalledWith({ jobId: 42, entryType: 'Rework', category: undefined, notes: 'Fix burrs' });

    component.openStartTimer();
    component.timerForm.patchValue({ category: 'Meeting' });
    component.startTimer();
    expect(service.startTimer).toHaveBeenLastCalledWith({ jobId: undefined, entryType: undefined, category: 'Meeting', notes: undefined });
    expect(jobOperations.startTimer).not.toHaveBeenCalled();
  });
});
