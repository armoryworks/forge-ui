import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Directive, input, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';

import { Observable, of } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { MobileHoursComponent } from './mobile-hours.component';

@Directive({ selector: '[appLoadingBlock]', standalone: true })
class StubLoadingBlockDirective {
  readonly appLoadingBlock = input(false);
}

class HoursStringsLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      mobileLegacy: {
        hours: {
          clockedInSince: 'Clocked in since',
          inProgressToday: 'In progress today',
          duration: '{{hours}}h {{minutes}}m',
          durationHours: '{{hours}}h',
          now: 'now',
          weekdays: { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' },
        },
      },
    });
  }
}

describe('MobileHoursComponent', () => {
  let fixture: ComponentFixture<MobileHoursComponent>;
  let http: HttpTestingController;

  const local = (day: number, hour: number, minute = 0, second = 0): string =>
    new Date(2026, 9, day, hour, minute, second).toISOString();

  const entry = (id: number, overrides: Record<string, unknown>) => ({
    id, jobNumber: null, date: '2026-10-08', durationMinutes: 0, category: 'Production', notes: null,
    timerStart: null, timerStop: null, ...overrides,
  });

  const weekEntries = [
    entry(1, { jobNumber: 'J-2401', date: '2026-10-06', durationMinutes: 90, timerStart: local(6, 8), timerStop: local(6, 9, 30) }),
    entry(2, { date: '2026-10-07', durationMinutes: 60 }),
    entry(3, { jobNumber: 'J-2403', date: '2026-10-08', timerStart: local(8, 9, 47, 30) }),
    entry(4, { date: '2026-10-04', durationMinutes: 480 }),
  ];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 10, 0, 0));

    await TestBed.configureTestingModule({
      imports: [MobileHoursComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: HoursStringsLoader }, lang: 'en' }),
        { provide: AuthService, useValue: { user: signal({ id: 7 }) } },
      ],
    })
      .overrideComponent(MobileHoursComponent, {
        remove: { imports: [LoadingBlockDirective] },
        add: { imports: [StubLoadingBlockDirective] },
      })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const render = (entries: unknown[], clock: { isClockedIn: boolean; clockedInAt: string | null }): void => {
    fixture = TestBed.createComponent(MobileHoursComponent);
    fixture.detectChanges();
    const list = http.expectOne((r) => r.url === '/api/v1/time-tracking/entries');
    expect(list.request.params.get('userId')).toBe('7');
    expect(list.request.params.get('from')).toBe('2026-10-04');
    expect(list.request.params.get('to')).toBe('2026-10-12');
    list.flush(entries);
    http.expectOne('/api/v1/time-tracking/clock-status').flush({ status: clock.isClockedIn ? 'In' : 'Out', ...clock });
    fixture.detectChanges();
  };

  const text = (testId: string): string =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';

  it('totals the week from the entries list, counting the running timer up to now', () => {
    render(weekEntries, { isClockedIn: true, clockedInAt: local(8, 7, 2) });

    expect(text('mhours-day-total-2026-10-06')).toBe('1h 30m');
    expect(text('mhours-day-total-2026-10-07')).toBe('1h');
    expect(text('mhours-day-total-2026-10-08')).toBe('0h 12m');
    expect(text('mhours-week-total')).toBe('2h 42m');
  });

  it('shows today\'s in-progress time and when the caller clocked in', () => {
    render(weekEntries, { isClockedIn: true, clockedInAt: local(8, 7, 2) });

    expect(text('mhours-in-progress')).toContain('In progress today');
    expect(text('mhours-in-progress')).toContain('0h 12m');
    expect(text('mhours-clocked-in-since')).toContain('Clocked in since');
    expect(text('mhours-clocked-in-since')).toContain('7:02');
  });

  it('shows no today card when clocked out with nothing running', () => {
    render([weekEntries[0]], { isClockedIn: false, clockedInAt: null });

    expect(text('mhours-today')).toBe('');
    expect(text('mhours-week-total')).toBe('1h 30m');
  });

  it('lists a running entry as running until now', () => {
    render(weekEntries, { isClockedIn: true, clockedInAt: local(8, 7, 2) });

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="mhours-day-2026-10-08"]')!.click();
    fixture.detectChanges();

    const detail = (fixture.nativeElement as HTMLElement).querySelector('.day-detail')!.textContent!;
    expect(detail).toContain('J-2403');
    expect(detail).toContain('now');
    expect(detail).toContain('0h 12m');
  });

  it('asks for the previous week and hides today\'s card there', () => {
    render(weekEntries, { isClockedIn: true, clockedInAt: local(8, 7, 2) });

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="mhours-prev-week"]')!.click();
    const list = http.expectOne((r) => r.url === '/api/v1/time-tracking/entries');
    expect(list.request.params.get('from')).toBe('2026-09-27');
    expect(list.request.params.get('to')).toBe('2026-10-05');
    list.flush([]);
    fixture.detectChanges();

    expect(text('mhours-today')).toBe('');
    expect(text('mhours-week-total')).toBe('0h');
  });
});
