import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { RunningTimersComponent } from './running-timers.component';
import { TimeEntry } from '../../../features/time-tracking/models/time-entry.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const NOW = Date.parse('2026-10-08T12:00:00Z');

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 5,
    jobId: 42,
    jobNumber: 'JOB-0042',
    userId: 1,
    userName: 'Rivera, Sam',
    date: new Date(NOW),
    durationMinutes: 0,
    category: 'Production',
    notes: null,
    timerStart: new Date(NOW - 65_000),
    timerStop: null,
    isManual: false,
    isLocked: false,
    createdAt: new Date(NOW),
    operationStepNumber: 3,
    operationTitle: 'Deburr',
    ...overrides,
  };
}

describe('RunningTimersComponent', () => {
  let fixture: ComponentFixture<RunningTimersComponent>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      imports: [RunningTimersComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } })],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  function render(timers: TimeEntry[], offset = 0): HTMLElement {
    fixture = TestBed.createComponent(RunningTimersComponent);
    fixture.componentRef.setInput('timers', timers);
    fixture.componentRef.setInput('clockOffsetMs', offset);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the job, step, title and elapsed time of each open timer', () => {
    const el = render([entry()]);
    const row = el.querySelector('[data-testid="running-timer-5"]')!;
    expect(row.textContent).toContain('JOB-0042');
    expect(row.textContent).toContain('Deburr');
    expect(row.querySelector('[data-testid="running-timer-elapsed"]')!.textContent!.trim()).toBe('1m 5s');
  });

  it('corrects the elapsed time with the server clock offset', () => {
    const el = render([entry()], 60_000);
    expect(el.querySelector('[data-testid="running-timer-elapsed"]')!.textContent!.trim()).toBe('2m 5s');
  });

  it('leaves out stopped timers and renders nothing when none are open', () => {
    const el = render([entry({ timerStop: new Date(NOW) })]);
    expect(el.querySelector('[data-testid="running-timers"]')).toBeNull();
  });

  it('emits the time entry id when Stop is pressed', () => {
    const el = render([entry()]);
    const stopped = vi.fn();
    fixture.componentInstance.stopRequested.subscribe(stopped);
    el.querySelector<HTMLButtonElement>('[data-testid="running-timer-stop"]')!.click();
    expect(stopped).toHaveBeenCalledWith(5);
  });
});
