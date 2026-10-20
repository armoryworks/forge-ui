import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CapabilityService } from '../../shared/services/capability.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { SchedulingComponent } from './scheduling.component';
import { SchedulingService } from './services/scheduling.service';

interface SchedulingApi {
  totalScheduled(): number;
}

function setup(tab: string) {
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
