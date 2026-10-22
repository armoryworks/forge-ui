import { TestBed } from '@angular/core/testing';

import { KioskRunningTimersComponent } from './kiosk-running-timers.component';
import { RunningTimer } from '../../models/running-timer.model';
import { RunningTimerCycles } from '../../models/running-timer-cycles.model';

interface CycleLine { timer: RunningTimer; cycle: { remainingMs: number; pending: number } | null }
interface CycleInternals { lines: () => CycleLine[]; recordCycle(line: CycleLine): void }

const START = Date.parse('2026-10-08T12:00:00Z');

function timer(overrides: Partial<RunningTimer>): RunningTimer {
  return {
    id: 1, jobId: 5, jobNumber: 'JOB-0005', userId: 3, timerStart: new Date(START).toISOString(),
    operationId: 50, jobOperationId: 9, operationStepNumber: 20, operationTitle: 'Press', entryType: 'Run', cycleMinutes: 2,
    ...overrides,
  };
}

describe('KioskRunningTimersComponent cycle countdown', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [KioskRunningTimersComponent] });
    TestBed.overrideComponent(KioskRunningTimersComponent, { set: { template: '', imports: [] } });
  });

  it('counts down the cycle, then offers the cycles that finished while it was on screen', () => {
    const fixture = TestBed.createComponent(KioskRunningTimersComponent);
    const component = fixture.componentInstance as unknown as CycleInternals;
    const emitted: RunningTimerCycles[] = [];
    fixture.componentInstance.recordCycles.subscribe(e => emitted.push(e));
    fixture.componentRef.setInput('timers', [timer({}), timer({ id: 2, cycleMinutes: null }), timer({ id: 3, entryType: 'Setup' })]);
    fixture.componentRef.setInput('now', START + 30_000);
    fixture.detectChanges();

    let lines = component.lines();
    expect(lines[0].cycle).toEqual({ remainingMs: 90_000, pending: 0 });
    expect(lines[1].cycle).toBeNull();
    expect(lines[2].cycle).toBeNull();

    fixture.componentRef.setInput('now', START + 250_000);
    fixture.detectChanges();
    lines = component.lines();
    expect(lines[0].cycle).toEqual({ remainingMs: 110_000, pending: 2 });

    component.recordCycle(lines[0]);
    expect(emitted).toEqual([{ timer: lines[0].timer, cycles: 2 }]);
    expect(component.lines()[0].cycle?.pending).toBe(0);
  });

  it('does not offer cycles that finished before the chip was shown', () => {
    const fixture = TestBed.createComponent(KioskRunningTimersComponent);
    fixture.componentRef.setInput('timers', [timer({})]);
    fixture.componentRef.setInput('now', START + 10 * 60_000 + 5_000);
    fixture.detectChanges();

    expect((fixture.componentInstance as unknown as CycleInternals).lines()[0].cycle?.pending).toBe(0);
  });
});
