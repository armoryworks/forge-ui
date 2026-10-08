import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Directive, input, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';

import { Observable, of } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { MobileJobDetailComponent } from './mobile-job-detail.component';

@Directive({ selector: '[appLoadingBlock]', standalone: true })
class StubLoadingBlockDirective {
  readonly appLoadingBlock = input(false);
}

class TimerStringsLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      mobileWeb: {
        timer: {
          runningOn: 'Running on {{jobNumber}}',
          switchHint: 'Switching stops the timer on {{jobNumber}}.',
          switchHere: 'Switch Timer Here',
          stoppedButNotStarted: 'The timer on {{jobNumber}} was stopped, but this one could not start: {{reason}}',
        },
      },
    });
  }
}

describe('MobileJobDetailComponent', () => {
  let fixture: ComponentFixture<MobileJobDetailComponent>;
  let http: HttpTestingController;

  const snackbar = { success: vi.fn(), error: vi.fn() };

  const job = {
    id: 5, jobNumber: 'J-1042', title: 'Bracket', description: null, stageName: 'Machining',
    stageColor: '#000', priorityName: 'Normal', partNumber: null, partDescription: null,
    customerName: null, dueDate: null, isOverdue: false, notes: null,
  };

  const timerOn = (jobId: number | null, jobNumber: string | null) => ({
    timeEntryId: 77, jobId, jobNumber, operationId: null, timerStart: '2026-10-07T14:30:00Z',
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [MobileJobDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: TimerStringsLoader }, lang: 'en' }),
        { provide: AuthService, useValue: { user: signal({ id: 1 }) } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ jobId: '5' }) } } },
      ],
    })
      .overrideComponent(MobileJobDetailComponent, {
        remove: { imports: [LoadingBlockDirective] },
        add: { imports: [StubLoadingBlockDirective] },
      })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const render = (timer: ReturnType<typeof timerOn> | null): void => {
    fixture = TestBed.createComponent(MobileJobDetailComponent);
    fixture.detectChanges();
    http.expectOne('/api/v1/jobs/5').flush(job);
    const active = http.expectOne('/api/v1/time-tracking/timer/active');
    if (timer) {
      active.flush(timer);
    } else {
      active.flush(null, { status: 204, statusText: 'No Content' });
    }
    fixture.detectChanges();
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const timerButton = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('[data-testid="mjob-timer-btn"]')!;

  it('offers Start when no timer is running', () => {
    render(null);

    expect(timerButton().textContent).toContain('Start Timer');
    expect(el().querySelector('[data-testid="mjob-timer-elsewhere"]')).toBeNull();
  });

  it('offers Stop when the caller is timing this job, and Stop ends it', () => {
    render(timerOn(5, 'J-1042'));
    expect(timerButton().textContent).toContain('Stop Timer');

    timerButton().click();
    const stop = http.expectOne('/api/v1/time-tracking/timer/stop');
    expect(stop.request.method).toBe('POST');
    expect(stop.request.body).toEqual({ timeEntryId: 77 });
    stop.flush({});
    http.expectOne('/api/v1/time-tracking/timer/active').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(snackbar.success).toHaveBeenCalledWith('Timer stopped');
    expect(timerButton().textContent).toContain('Start Timer');
  });

  it('shows the other job and switches the timer when starting here', () => {
    render(timerOn(9, 'J-2001'));

    expect(el().querySelector('[data-testid="mjob-timer-elsewhere"]')!.textContent).toContain('Running on J-2001');
    expect(el().querySelector('[data-testid="mjob-timer-switch-hint"]')!.textContent)
      .toContain('Switching stops the timer on J-2001.');
    expect(timerButton().textContent).toContain('Switch Timer Here');

    timerButton().click();
    const stopOther = http.expectOne('/api/v1/time-tracking/timer/stop');
    expect(stopOther.request.body).toEqual({ timeEntryId: 77 });
    stopOther.flush({});
    const start = http.expectOne('/api/v1/time-tracking/timer/start');
    expect(start.request.body).toEqual({ jobId: 5 });
    start.flush({ id: 78 });
    http.expectOne('/api/v1/time-tracking/timer/active').flush(timerOn(5, 'J-1042'));
    fixture.detectChanges();

    expect(timerButton().textContent).toContain('Stop Timer');
    expect(el().querySelector('[data-testid="mjob-timer-elsewhere"]')).toBeNull();
  });

  it('stops the timer running on another job', () => {
    render(timerOn(9, 'J-2001'));

    el().querySelector<HTMLButtonElement>('[data-testid="mjob-timer-elsewhere-stop-btn"]')!.click();
    const stop = http.expectOne('/api/v1/time-tracking/timer/stop');
    expect(stop.request.body).toEqual({ timeEntryId: 77 });
    stop.flush({});
    http.expectOne('/api/v1/time-tracking/timer/active').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="mjob-timer-elsewhere"]')).toBeNull();
  });

  it('says the other timer was stopped when the switch fails to start this one', () => {
    render(timerOn(9, 'J-2001'));

    timerButton().click();
    http.expectOne('/api/v1/time-tracking/timer/stop').flush({});
    http.expectOne('/api/v1/time-tracking/timer/start').flush(
      { title: 'Validation', detail: 'This job is on hold.' },
      { status: 400, statusText: 'Bad Request' },
    );
    http.expectOne('/api/v1/time-tracking/timer/active').flush(null, { status: 204, statusText: 'No Content' });

    expect(snackbar.error).toHaveBeenCalledWith(
      'The timer on J-2001 was stopped, but this one could not start: This job is on hold.',
    );
  });

  it('shows the server message when starting fails', () => {
    render(null);

    timerButton().click();
    http.expectOne('/api/v1/time-tracking/timer/start').flush(
      { title: 'Conflict', detail: 'A timer is already running. Stop it before starting a new one.' },
      { status: 409, statusText: 'Conflict' },
    );
    http.expectOne('/api/v1/time-tracking/timer/active').flush(null, { status: 204, statusText: 'No Content' });

    expect(snackbar.error).toHaveBeenCalledWith('A timer is already running. Stop it before starting a new one.');
  });
});
