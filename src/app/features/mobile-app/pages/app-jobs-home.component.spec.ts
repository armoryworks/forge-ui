import { Signal, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { ActiveTimer } from '../../../shared/models/mobile-api.model';
import { MyJob } from '../../../shared/models/my-job.model';
import { RunningTimer } from '../../../shared/models/running-timer.model';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { AppJobsHomeComponent } from './app-jobs-home.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface JobsHomeInternals {
  searchControl: FormControl<string>;
  jobs: Signal<MyJob[]>;
  visibleJobs: Signal<MyJob[]>;
  needsIdentity: Signal<boolean>;
}

const job = (id: number, jobNumber: string, title: string, partNumber: string | null): MyJob => ({
  id, jobNumber, title, partNumber, quantity: 10, dueDate: null, stageId: 1, stageName: 'Machining',
  isOverdue: false, hasRunningTimer: false,
});

function operationTimer(id: number, jobId: number, jobNumber: string, step: number, title: string): RunningTimer {
  return {
    id, jobId, jobNumber, userId: 1, operationId: step, jobOperationId: id, operationStepNumber: step,
    operationTitle: title, entryType: 'Run', timerStart: '2026-10-07T10:00:00Z',
  };
}

describe('AppJobsHomeComponent', () => {
  let shared: boolean;
  const identified = signal(false);
  const myJobs = vi.fn();
  const operationTracking = signal(false);
  const active = signal<ActiveTimer | null>(null);
  const operationTimers = signal<RunningTimer[]>([]);

  function create(): JobsHomeInternals {
    const component = TestBed.runInInjectionContext(() => new AppJobsHomeComponent());
    TestBed.tick();
    return component as unknown as JobsHomeInternals;
  }

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AppJobsHomeComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    shared = false;
    identified.set(false);
    operationTracking.set(false);
    active.set({ timeEntryId: 9, jobId: 42, jobNumber: 'JOB-42', operationId: null, timerStart: new Date() });
    operationTimers.set([]);
    myJobs.mockReset().mockReturnValue(of([
      job(1, 'JOB-1001', 'Bracket', 'BRKT-100'),
      job(2, 'JOB-1002', 'Housing', null),
    ]));
    TestBed.configureTestingModule({
      imports: [AppJobsHomeComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MobileApiService, useValue: { myJobs } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
        { provide: SharedIdentityService, useValue: { identified } },
        { provide: MobileTimerService, useValue: { operationTracking, active, operationTimers } },
      ],
    });
  });

  it('lists the person\'s work orders', () => {
    const home = create();

    expect(myJobs).toHaveBeenCalledOnce();
    expect(home.visibleJobs().map((j) => j.id)).toEqual([1, 2]);
  });

  it('narrows the list by job number, title or part number', () => {
    const home = create();

    home.searchControl.setValue('brkt');
    expect(home.visibleJobs().map((j) => j.id)).toEqual([1]);

    home.searchControl.setValue('housing');
    expect(home.visibleJobs().map((j) => j.id)).toEqual([2]);

    home.searchControl.setValue('job-100');
    expect(home.visibleJobs()).toHaveLength(2);
  });

  it('on a shared device, waits for the person to identify before loading', () => {
    shared = true;
    const home = create();

    expect(home.needsIdentity()).toBe(true);
    expect(myJobs).not.toHaveBeenCalled();

    identified.set(true);
    TestBed.tick();

    expect(myJobs).toHaveBeenCalledOnce();
    expect(home.jobs()).toHaveLength(2);
  });

  it('shows no running section while operation tracking is off', () => {
    const el = render();

    expect(el.querySelector('[data-testid^="jobs-home-running-"]')).toBeNull();
    expect(el.querySelector('a[href="/app/scan"]')).not.toBeNull();
  });

  it('lists each job the person is timing once, with its running steps, above My work orders', () => {
    operationTracking.set(true);
    operationTimers.set([
      operationTimer(31, 42, 'JOB-42', 20, 'Deburr'),
      operationTimer(32, 42, 'JOB-42', 30, 'Inspect'),
      operationTimer(33, 7, 'JOB-7', 10, 'Saw'),
    ]);

    const el = render();
    const jobs = [...el.querySelectorAll<HTMLAnchorElement>('[data-testid^="jobs-home-running-"]')];

    expect(jobs.map((a) => a.getAttribute('href'))).toEqual(['/app/jobs/42', '/app/jobs/7']);
    expect(jobs[0].textContent).toContain('20 Deburr');
    expect(jobs[0].textContent).toContain('30 Inspect');
    expect(jobs[0].textContent).toContain('mobileApp.operations.jobTimer');
    expect(jobs[1].textContent).not.toContain('mobileApp.operations.jobTimer');
    const firstRow = el.querySelector('[data-testid="jobs-home-row-1"]')!;
    expect(jobs[1].compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
