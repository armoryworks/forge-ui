import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';

import { Observable, of } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ClockEventTypeService } from '../../../shared/services/clock-event-type.service';
import { MobileClockStateService } from '../services/mobile-clock-state.service';

// Stub the LoadingBlockDirective to avoid input.required errors
import { Directive, Input } from '@angular/core';
@Directive({ selector: '[appLoadingBlock]', standalone: true })
class MockLoadingBlockDirective {
  @Input() appLoadingBlock: boolean = false;
}

import { MobileClockComponent } from './mobile-clock.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

class ClockStringsLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      mobileLegacy: {
        timer: { onJob: 'Timer on {{jobNumber}}', onOperation: '{{jobNumber}} · Op {{step}} {{title}}' },
        clock: {
          since: 'Since {{time}}',
          recorded: '{{action}} recorded',
          recordedTimerStopped: '{{action}} recorded. Your timer on {{jobNumber}} was stopped.',
          recordFailed: 'Failed to record clock event',
          timerWillStop: 'Your timer on {{jobNumber}} will stop too',
          timersWillStop: 'Your {{count}} running timers will stop too',
        },
      },
    });
  }
}

describe('MobileClockComponent', () => {
  let fixture: ComponentFixture<MobileClockComponent>;
  let component: MobileClockComponent;
  let httpTesting: HttpTestingController;

  const mockUser = { id: 1, firstName: 'John', lastName: 'Doe' };

  const mockAuthService = {
    user: signal(mockUser),
  };

  const mockSnackbar = {
    success: vi.fn(),
    error: vi.fn(),
  };

  const clockOutAction = { code: 'ClockOut', label: 'Clock Out', statusMapping: 'Out', oppositeCode: 'ClockIn', category: 'work', countsAsActive: false, isMismatchable: false, icon: 'logout', color: '#ef4444' };

  const runningTimer = (id: number, jobNumber: string | null, step: number | null = null) => ({
    id, jobId: id, jobNumber, userId: 1, operationId: null, jobOperationId: step === null ? null : 900 + id,
    operationStepNumber: step, operationTitle: step === null ? null : 'Deburr', entryType: 'Run',
    timerStart: new Date(Date.now() - 754_000).toISOString(),
  });

  const clockInAction = { code: 'ClockIn', label: 'Clock In', statusMapping: 'In', oppositeCode: 'ClockOut', category: 'work', countsAsActive: true, isMismatchable: false, icon: 'login', color: '#22c55e' };

  const mockDefinitions = signal<unknown[]>([]);

  const mockClockTypes = {
    load: vi.fn(),
    getLabel: vi.fn().mockReturnValue('Clocked Out'),
    getStatusCssClass: vi.fn().mockReturnValue('out'),
    getAvailableActions: vi.fn().mockReturnValue([clockInAction]),
    definitions: mockDefinitions,
  };

  const mockClockState = {
    update: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDefinitions.set([]);
    mockClockTypes.getAvailableActions.mockReturnValue([clockInAction]);

    await TestBed.configureTestingModule({
      imports: [MobileClockComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: ClockStringsLoader }, lang: 'en' }),
        { provide: AuthService, useValue: mockAuthService },
        { provide: SnackbarService, useValue: mockSnackbar },
        { provide: ClockEventTypeService, useValue: mockClockTypes },
        { provide: MobileClockStateService, useValue: mockClockState },
      ],
    })
      .overrideComponent(MobileClockComponent, {
        remove: { imports: [LoadingBlockDirective] },
        add: { imports: [MockLoadingBlockDirective] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  function createComponent(): MobileClockComponent {
    fixture = TestBed.createComponent(MobileClockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  }

  function flushTimers(timers: unknown[] = []): void {
    httpTesting.expectOne('/api/v1/time-tracking/timers/active').flush(timers);
  }

  function flushInitRequests(): void {
    flushTimers();
    httpTesting.expectOne('/api/v1/time-tracking/clock-status').flush({
      isClockedIn: false,
      status: 'Out',
      clockedInAt: null,
    });
    // Trigger the effect that recomputes actions when definitions load
    mockDefinitions.set([clockInAction]);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    const comp = createComponent();
    flushInitRequests();
    expect(comp).toBeTruthy();
  });

  it('should load clock event types on init', () => {
    createComponent();
    flushInitRequests();
    expect(mockClockTypes.load).toHaveBeenCalled();
  });

  it('should load current status on init', () => {
    createComponent();
    flushTimers();

    const req = httpTesting.expectOne('/api/v1/time-tracking/clock-status');
    expect(req.request.method).toBe('GET');
    req.flush({
      isClockedIn: true,
      status: 'In',
      clockedInAt: '2026-04-10T08:00:00Z',
    });

    expect(component['status']()).toBeTruthy();
    expect(component['status']()?.isClockedIn).toBe(true);
    expect(component['loading']()).toBe(false);
  });

  it('should display available actions', () => {
    createComponent();
    flushInitRequests();

    expect(mockClockTypes.getAvailableActions).toHaveBeenCalledWith('Out');
    expect(component['actions']().length).toBe(1);
    expect(component['actions']()[0].code).toBe('ClockIn');
  });

  it('should submit clock event', () => {
    createComponent();
    flushInitRequests();

    const action = {
      code: 'ClockIn',
      label: 'Clock In',
      statusMapping: 'In',
      oppositeCode: 'ClockOut',
      category: 'work',
      countsAsActive: true,
      isMismatchable: false,
      icon: 'login',
      color: '#22c55e',
    };

    component['submitClock'](action);

    const clockReq = httpTesting.expectOne('/api/v1/display/shop-floor/clock');
    expect(clockReq.request.method).toBe('POST');
    expect(clockReq.request.body).toEqual({
      userId: mockUser.id,
      eventType: 'ClockIn',
    });
    clockReq.flush({});

    expect(mockSnackbar.success).toHaveBeenCalledWith('Clock In recorded');
    expect(component['submitting']()).toBe(false);

    flushTimers();
    httpTesting.expectOne('/api/v1/time-tracking/clock-status').flush({
      isClockedIn: true,
      status: 'In',
      clockedInAt: '2026-04-10T08:00:00Z',
    });
  });

  it('should show error snackbar on submit failure', () => {
    createComponent();
    flushInitRequests();

    const action = {
      code: 'ClockIn',
      label: 'Clock In',
      statusMapping: 'In',
      oppositeCode: 'ClockOut',
      category: 'work',
      countsAsActive: true,
      isMismatchable: false,
      icon: 'login',
      color: '#22c55e',
    };

    component['submitClock'](action);

    httpTesting.expectOne('/api/v1/display/shop-floor/clock').flush(
      { message: 'Server error' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(mockSnackbar.error).toHaveBeenCalledWith('Failed to record clock event');
    expect(component['submitting']()).toBe(false);
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function renderClockedIn(timers: unknown[]): void {
    mockClockTypes.getAvailableActions.mockReturnValue([clockOutAction]);
    createComponent();
    flushTimers(timers);
    httpTesting.expectOne('/api/v1/time-tracking/clock-status').flush({
      isClockedIn: true,
      status: 'In',
      clockedInAt: '2026-04-10T08:00:00Z',
    });
    mockDefinitions.set([clockOutAction]);
    fixture.detectChanges();
  }

  it('shows the running job timer with its elapsed time', () => {
    renderClockedIn([runningTimer(59, 'J-2403')]);

    const rows = el().querySelectorAll('[data-testid="clock-running-timer"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Timer on J-2403');
    expect(el().querySelector('[data-testid="clock-running-timer-elapsed"]')!.textContent).toMatch(/^0:12:3\d$/);
  });

  it('names an operation timer by its step', () => {
    renderClockedIn([runningTimer(59, 'J-2403', 30)]);

    expect(el().querySelector('[data-testid="clock-running-timer"]')!.textContent).toContain('J-2403 · Op 30 Deburr');
  });

  it('warns on Clock Out that the running timer will stop too', () => {
    renderClockedIn([runningTimer(59, 'J-2403')]);

    const button = el().querySelector<HTMLButtonElement>('[data-testid="clock-action-ClockOut"]')!;
    const warning = button.querySelector('[data-testid="clock-timer-stop-warning"]')!;
    expect(warning.textContent!.trim()).toBe('Your timer on J-2403 will stop too');
    expect(button.getAttribute('aria-describedby')).toBe(warning.id);
  });

  it('counts the timers that will stop when more than one is running', () => {
    renderClockedIn([runningTimer(59, 'J-2403'), runningTimer(60, 'J-2404', 20)]);

    expect(el().querySelector('[data-testid="clock-timer-stop-warning"]')!.textContent!.trim())
      .toBe('Your 2 running timers will stop too');
  });

  it('shows no timer and no warning when nothing is running', () => {
    renderClockedIn([]);

    expect(el().querySelector('[data-testid="clock-running-timer"]')).toBeNull();
    expect(el().querySelector('[data-testid="clock-timer-stop-warning"]')).toBeNull();
  });

  it('says the timer was stopped after clocking out, then reloads the timers', () => {
    renderClockedIn([runningTimer(59, 'J-2403')]);

    el().querySelector<HTMLButtonElement>('[data-testid="clock-action-ClockOut"]')!.click();
    httpTesting.expectOne('/api/v1/display/shop-floor/clock').flush(null, { status: 204, statusText: 'No Content' });

    expect(mockSnackbar.success).toHaveBeenCalledWith('Clock Out recorded. Your timer on J-2403 was stopped.');
    flushTimers();
    httpTesting.expectOne('/api/v1/time-tracking/clock-status').flush({ isClockedIn: false, status: 'Out', clockedInAt: null });
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="clock-running-timer"]')).toBeNull();
  });
});
