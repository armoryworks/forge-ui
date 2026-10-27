import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { SchedulingComponent } from './scheduling.component';
import { SchedulingService } from './services/scheduling.service';

interface SchedulingApi {
  totalScheduled(): number;
}

function setup(tab: string, roles: string[] = ['Manager']) {
  const scheduling = {
    getGanttData: vi.fn(() => of([
      { id: 1, status: 'Scheduled' }, { id: 2, status: 'Scheduled' }, { id: 3, status: 'InProgress' },
    ])),
    getWorkCenters: vi.fn(() => of([])),
    getShifts: vi.fn(() => of([])),
    getScheduleRuns: vi.fn(() => of([])),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab })), queryParamMap: of(convertToParamMap({})) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: SchedulingService, useValue: scheduling },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: DraftResumeService, useValue: { consume: () => false } },
      { provide: CapabilityService, useValue: { isEnabled: () => false } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new SchedulingComponent()) as unknown as SchedulingApi;
  TestBed.flushEffects();
  return { page, scheduling };
}

describe('SchedulingComponent · header KPIs', () => {
  it('counts scheduled operations on a tab other than the schedule', () => {
    const { page, scheduling } = setup('runs');

    expect(scheduling.getGanttData).toHaveBeenCalledTimes(1);
    expect(page.totalScheduled()).toBe(2);
  });

  it('loads the schedule once when opening on the schedule tab', () => {
    const { page, scheduling } = setup('gantt');

    expect(scheduling.getGanttData).toHaveBeenCalledTimes(1);
    expect(page.totalScheduled()).toBe(2);
  });
});

describe('SchedulingComponent · production planner', () => {
  it('lets a manager manage work centers and shift assignments', () => {
    const { page } = setup('work-centers', ['Manager']);

    expect((page as unknown as { canManageWorkCenters: boolean }).canManageWorkCenters).toBe(true);
  });

  it('keeps the planner to running and reading the schedule', () => {
    const { page } = setup('work-centers', ['Production Planner']);

    expect((page as unknown as { canManageWorkCenters: boolean }).canManageWorkCenters).toBe(false);
    expect((page as unknown as { shiftAssignmentsEnabled(): boolean }).shiftAssignmentsEnabled()).toBe(false);
  });
});

describe('SchedulingComponent · run scheduler', () => {
  const request = { direction: 'Backward', scheduleFrom: '2026-11-23', scheduleTo: '2026-12-23', priorityRule: 'Priority' };
  let runScheduler: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let dialogResult: unknown;
  let view: { executeSchedule(): void };

  beforeEach(() => {
    TestBed.resetTestingModule();
    runScheduler = vi.fn(() => new Subject());
    dialogResult = request;
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
    const service = new Proxy({ runScheduler } as Record<string, unknown>, {
      get: (target, key: string) => target[key] ?? (() => of([])),
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: SchedulingService, useValue: service },
        { provide: ActivatedRoute, useValue: {
          paramMap: new BehaviorSubject(convertToParamMap({ tab: 'gantt' })),
          queryParamMap: new BehaviorSubject(convertToParamMap({})),
        } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: DraftResumeService, useValue: { consume: vi.fn(() => false) } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new SchedulingComponent()) as unknown as typeof view;
  });

  it('starts one scheduler run when Run is pressed twice before the server answers', () => {
    view.executeSchedule();
    view.executeSchedule();

    expect(runScheduler).toHaveBeenCalledTimes(1);
  });

  it('runs with the direction, range and priority rule chosen in the dialog', () => {
    view.executeSchedule();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(runScheduler).toHaveBeenCalledWith(request);
  });

  it('does not run when the dialog is cancelled', () => {
    dialogResult = undefined;

    view.executeSchedule();

    expect(runScheduler).not.toHaveBeenCalled();
  });

  it('lets Run be pressed again after the server rejects the first run', () => {
    runScheduler.mockReturnValueOnce(throwError(() => new Error('409')));

    view.executeSchedule();
    view.executeSchedule();

    expect(runScheduler).toHaveBeenCalledTimes(2);
  });
});
