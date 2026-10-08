import { TestBed } from '@angular/core/testing';

import { KioskRunningTimersComponent } from './kiosk-running-timers.component';
import { RunningTimer } from '../../models/running-timer.model';

function timer(overrides: Partial<RunningTimer>): RunningTimer {
  return {
    id: 1, jobId: 5, jobNumber: 'JOB-0005', userId: 3, timerStart: '2026-10-08T11:00:00Z',
    operationId: null, jobOperationId: null, operationStepNumber: null, operationTitle: null, entryType: 'Run',
    ...overrides,
  };
}

describe('KioskRunningTimersComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [KioskRunningTimersComponent] });
    TestBed.overrideComponent(KioskRunningTimersComponent, { set: { template: '', imports: [] } });
  });

  it('labels operation timers by step and measures elapsed time against the server-corrected clock', () => {
    const fixture = TestBed.createComponent(KioskRunningTimersComponent);
    fixture.componentRef.setInput('timers', [
      timer({ id: 1 }),
      timer({ id: 2, operationStepNumber: 3, operationTitle: 'Deburr', timerStart: '2026-10-08T11:59:00.400Z' }),
      timer({ id: 3, timerStart: null }),
    ]);
    fixture.componentRef.setInput('now', Date.parse('2026-10-08T12:00:00Z'));
    const lines = (fixture.componentInstance as unknown as {
      lines: () => { timer: RunningTimer; stepLabel: string | null; elapsedMs: number }[];
    }).lines();

    expect(lines.map(l => l.timer.id)).toEqual([1, 2]);
    expect(lines[0].stepLabel).toBeNull();
    expect(lines[0].elapsedMs).toBe(3_600_000);
    expect(lines[1].stepLabel).toBe('3 · Deburr');
    expect(lines[1].elapsedMs).toBe(60_000);
  });

  it('never shows a negative elapsed time when the device clock runs ahead', () => {
    const fixture = TestBed.createComponent(KioskRunningTimersComponent);
    fixture.componentRef.setInput('timers', [timer({ timerStart: '2026-10-08T12:00:05Z' })]);
    fixture.componentRef.setInput('now', Date.parse('2026-10-08T12:00:00Z'));
    const lines = (fixture.componentInstance as unknown as { lines: () => { elapsedMs: number }[] }).lines();
    expect(lines[0].elapsedMs).toBe(0);
  });
});
