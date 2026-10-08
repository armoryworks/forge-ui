import { TestBed } from '@angular/core/testing';

import { KioskOperationTilesComponent } from './kiosk-operation-tiles.component';
import { JobOperationRow } from '../../models/job-operation-row.model';

interface Tile {
  row: JobOperationRow;
  statusKey: string;
  closed: boolean;
  mineRunning: boolean;
  othersInitials: string;
  elapsedMs: number | null;
}

function row(stepNumber: number, overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 100 + stepNumber, jobOperationId: null, version: null, stepNumber, title: `Step ${stepNumber}`,
    workCenterName: null, isRoutingStep: true, status: 'NotStarted', completedQuantity: 0, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null,
    estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0,
    actualRunMinutesEach: null, remainingMinutes: 40, historyRunMinutesEach: null, historyJobCount: 0, openTimers: [],
    ...overrides,
  };
}

const timer = (userId: number, initials: string, timerStart: string) => ({
  timeEntryId: userId * 10, userId, userName: `User ${userId}`, userInitials: initials, entryType: 'Run', timerStart,
});

describe('KioskOperationTilesComponent', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');

  function tiles(operations: JobOperationRow[]): Tile[] {
    const fixture = TestBed.createComponent(KioskOperationTilesComponent);
    fixture.componentRef.setInput('operations', operations);
    fixture.componentRef.setInput('jobQuantity', 40);
    fixture.componentRef.setInput('currentUserId', 3);
    fixture.componentRef.setInput('now', now);
    return (fixture.componentInstance as unknown as { tiles: () => Tile[] }).tiles();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [KioskOperationTilesComponent] });
    TestBed.overrideComponent(KioskOperationTilesComponent, { set: { template: '', imports: [] } });
  });

  it('shows my running timer as mine, with its live elapsed time, and others by initials', () => {
    const [tile] = tiles([row(2, {
      status: 'InProgress',
      openTimers: [timer(8, 'AB', '2026-10-08T11:00:00Z'), timer(3, 'PD', '2026-10-08T11:58:29.600Z')],
    })]);

    expect(tile.mineRunning).toBe(true);
    expect(tile.elapsedMs).toBe(90_000);
    expect(tile.othersInitials).toBe('AB');
    expect(tile.statusKey).toBe('shopFloor.operations.status.InProgress');
  });

  it('shows someone else\'s elapsed time when I am not running the step', () => {
    const [tile] = tiles([row(2, { openTimers: [timer(8, 'AB', '2026-10-08T11:59:00Z')] })]);
    expect(tile.mineRunning).toBe(false);
    expect(tile.elapsedMs).toBe(60_000);
  });

  it('marks finished steps closed and leaves out steps no longer on the routing', () => {
    const result = tiles([
      row(1, { status: 'Complete' }),
      row(2, { status: 'Skipped' }),
      row(3),
      row(4, { isRoutingStep: false }),
      row(5, { operationId: null }),
    ]);

    expect(result.map(t => t.row.stepNumber)).toEqual([1, 2, 3]);
    expect(result.map(t => t.closed)).toEqual([true, true, false]);
    expect(result[2].elapsedMs).toBeNull();
  });
});
