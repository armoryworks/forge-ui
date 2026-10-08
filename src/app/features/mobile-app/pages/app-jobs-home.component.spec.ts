import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { ActiveTimer } from '../../../shared/models/mobile-api.model';
import { RunningTimer } from '../../../shared/models/running-timer.model';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { AppJobsHomeComponent } from './app-jobs-home.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function operationTimer(id: number, jobId: number, jobNumber: string, step: number, title: string): RunningTimer {
  return {
    id, jobId, jobNumber, userId: 1, operationId: step, jobOperationId: id, operationStepNumber: step,
    operationTitle: title, entryType: 'Run', timerStart: '2026-10-07T10:00:00Z',
  };
}

describe('AppJobsHomeComponent', () => {
  const operationTracking = signal(false);
  const active = signal<ActiveTimer | null>(null);
  const operationTimers = signal<RunningTimer[]>([]);

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AppJobsHomeComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    operationTracking.set(false);
    active.set({ timeEntryId: 9, jobId: 42, jobNumber: 'JOB-42', operationId: null, timerStart: new Date() });
    operationTimers.set([]);
    TestBed.configureTestingModule({
      imports: [AppJobsHomeComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MobileTimerService, useValue: { operationTracking, active, operationTimers } },
      ],
    });
  });

  it('only points at Scan while operation tracking is off', () => {
    const el = render();

    expect(el.querySelector('[data-testid^="jobs-home-running-"]')).toBeNull();
    expect(el.querySelector('a[href="/app/scan"]')).not.toBeNull();
  });

  it('lists each job the person is timing once, with its running steps, linking to Job Status', () => {
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
  });
});
