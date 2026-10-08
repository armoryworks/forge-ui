import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { TimeTrackingComponent } from './time-tracking.component';
import { TimeEntry } from './models/time-entry.model';
import { TimeTrackingService } from './services/time-tracking.service';
import { AuthService } from '../../shared/services/auth.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { RunningTimersService } from '../../shared/services/running-timers.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { TimerHubService } from '../../shared/services/timer-hub.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PageInternals {
  activeTimer: () => TimeEntry | null;
  otherRunningTimers: () => TimeEntry[];
  stopTarget: () => TimeEntry | null;
  openStopTimer(entry?: TimeEntry | null): void;
  openStopTimerById(id: number): void;
  stopTimer(): void;
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

function setup(entries: TimeEntry[], mine: Observable<TimeEntry[]>) {
  const service = {
    getTimeEntries: vi.fn().mockReturnValue(of(entries)),
    stopTimer: vi.fn().mockReturnValue(of({})),
  };
  const running = { getMine: vi.fn().mockReturnValue(mine) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: TimeTrackingService, useValue: service },
      { provide: RunningTimersService, useValue: running },
      { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      { provide: TimerHubService, useValue: { connect: vi.fn().mockResolvedValue(undefined), onTimerStartedEvent: vi.fn(), onTimerStoppedEvent: vi.fn(), clearCallbacks: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: DraftResumeService, useValue: { consume: vi.fn().mockReturnValue(false) } },
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
});
