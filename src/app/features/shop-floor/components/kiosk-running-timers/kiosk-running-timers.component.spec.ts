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

  it('turns a chip amber once it has been open ten hours', () => {
    const fixture = TestBed.createComponent(KioskRunningTimersComponent);
    fixture.componentRef.setInput('timers', [
      timer({ id: 1, timerStart: '2026-10-08T02:00:00Z' }),
      timer({ id: 2, timerStart: '2026-10-08T02:00:01Z' }),
    ]);
    fixture.componentRef.setInput('now', Date.parse('2026-10-08T12:00:00Z'));
    const lines = (fixture.componentInstance as unknown as { lines: () => { stale: boolean }[] }).lines();
    expect(lines.map(l => l.stale)).toEqual([true, false]);
  });

  it('offers Stop, Record pieces and Stop + Done for a step timer and stops a whole-job timer straight away', () => {
    const fixture = TestBed.createComponent(KioskRunningTimersComponent);
    const step = timer({ id: 4, operationId: 70, operationStepNumber: 2 });
    const whole = timer({ id: 5 });
    fixture.componentRef.setInput('timers', [step, whole]);
    fixture.componentRef.setInput('now', Date.parse('2026-10-08T12:00:00Z'));
    const stops: RunningTimer[] = [];
    const records: RunningTimer[] = [];
    const dones: RunningTimer[] = [];
    fixture.componentInstance.stop.subscribe(t => stops.push(t));
    fixture.componentInstance.recordPieces.subscribe(t => records.push(t));
    fixture.componentInstance.stopDone.subscribe(t => dones.push(t));
    const component = fixture.componentInstance as unknown as {
      lines: () => { timer: RunningTimer; isStep: boolean }[];
      toggle: (line: unknown) => void;
      act: (kind: 'stop' | 'record' | 'done', timer: RunningTimer) => void;
      expandedId: () => number | null;
    };

    component.toggle(component.lines()[0]);
    expect(component.expandedId()).toBe(4);
    component.act('record', step);
    component.act('done', step);
    component.act('stop', step);
    component.toggle(component.lines()[1]);

    expect(records).toEqual([step]);
    expect(dones).toEqual([step]);
    expect(stops).toEqual([step, whole]);
    expect(component.expandedId()).toBeNull();
  });
});
