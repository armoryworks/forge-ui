import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { SchedulingComponent } from './scheduling.component';
import { SchedulingService } from './services/scheduling.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { CapabilityService } from '../../shared/services/capability.service';

describe('SchedulingComponent · run scheduler', () => {
  let runScheduler: ReturnType<typeof vi.fn>;
  let view: { executeSchedule(): void };

  beforeEach(() => {
    TestBed.resetTestingModule();
    runScheduler = vi.fn(() => new Subject());
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
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: DraftResumeService, useValue: { consume: vi.fn(() => false) } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
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

  it('lets Run be pressed again after the server rejects the first run', () => {
    runScheduler.mockReturnValueOnce(throwError(() => new Error('409')));

    view.executeSchedule();
    view.executeSchedule();

    expect(runScheduler).toHaveBeenCalledTimes(2);
  });
});
