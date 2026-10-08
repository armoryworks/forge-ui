import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Directive, input, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';

import { Observable, of } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { MobileJobsComponent } from './mobile-jobs.component';

@Directive({ selector: '[appLoadingBlock]', standalone: true })
class StubLoadingBlockDirective {
  readonly appLoadingBlock = input(false);
}

class JobsStringsLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      mobileLegacy: {
        jobs: {
          title: 'My Jobs',
          overdue: 'Overdue',
          empty: 'No jobs assigned to you',
          running: 'Running {{elapsed}}',
          runningOperation: 'Op {{step}} running {{elapsed}}',
        },
      },
    });
  }
}

describe('MobileJobsComponent', () => {
  let fixture: ComponentFixture<MobileJobsComponent>;
  let http: HttpTestingController;

  const job = (id: number, jobNumber: string, isOverdue = false) => ({
    id, jobNumber, title: `Bracket ${id}`, stageName: 'Machining', stageColor: '#000', priorityName: 'Normal', isOverdue,
  });

  const timer = (id: number, jobId: number, step: number | null = null) => ({
    id, jobId, jobNumber: `J-${jobId}`, userId: 1, operationId: null, jobOperationId: step === null ? null : 500 + id,
    operationStepNumber: step, operationTitle: null, entryType: 'Run',
    timerStart: new Date(Date.now() - 754_000).toISOString(),
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileJobsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: JobsStringsLoader }, lang: 'en' }),
        { provide: AuthService, useValue: { user: signal({ id: 1 }) } },
      ],
    })
      .overrideComponent(MobileJobsComponent, {
        remove: { imports: [LoadingBlockDirective] },
        add: { imports: [StubLoadingBlockDirective] },
      })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const render = (jobs: unknown[], timers: unknown[]): void => {
    fixture = TestBed.createComponent(MobileJobsComponent);
    fixture.detectChanges();
    http.expectOne('/api/v1/time-tracking/timers/active').flush(timers);
    const list = http.expectOne((r) => r.url === '/api/v1/jobs');
    expect(list.request.params.get('assigneeId')).toBe('1');
    list.flush({ items: jobs });
    fixture.detectChanges();
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('shows a running badge with elapsed time only on the job being timed', () => {
    render([job(59, 'J-2403'), job(60, 'J-2404')], [timer(1, 59)]);

    const badge = el().querySelector('[data-testid="mjobs-running-59"]');
    expect(badge!.textContent).toMatch(/Running 0:12:3\d/);
    expect(el().querySelector('[data-testid="mjobs-running-60"]')).toBeNull();
  });

  it('names the step of a running operation timer', () => {
    render([job(59, 'J-2403')], [timer(1, 59, 30)]);

    expect(el().querySelector('[data-testid="mjobs-running-59"]')!.textContent).toMatch(/Op 30 running 0:12:3\d/);
  });

  it('shows no badge when nothing is running', () => {
    render([job(59, 'J-2403', true)], []);

    expect(el().querySelector('[data-testid="mjobs-item-59"]')!.textContent).toContain('Overdue');
    expect(el().querySelector('[data-testid^="mjobs-running-"]')).toBeNull();
  });

  it('says when no jobs are assigned', () => {
    render([], []);

    expect(el().textContent).toContain('No jobs assigned to you');
  });
});
