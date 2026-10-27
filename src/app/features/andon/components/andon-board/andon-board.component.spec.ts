import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AndonAlert } from '../../models/andon-alert.model';
import { AndonService } from '../../services/andon.service';
import { AndonBoardComponent } from './andon-board.component';

function alert(id: number, overrides: Partial<AndonAlert> = {}): AndonAlert {
  return {
    id, workCenterId: 3, workCenterName: 'Press 4', type: 'Stoppage', status: 'Active', requestedByName: 'Doe, Pat',
    requestedAt: new Date(Date.now() - id * 60_000).toISOString(), acknowledgedByName: null, acknowledgedAt: null,
    resolvedByName: null, resolvedAt: null, responseTimeMinutes: null, resolutionTimeMinutes: null, notes: null,
    jobId: null, jobNumber: null, ...overrides,
  };
}

interface BoardInternals {
  ngOnInit(): void;
  rows: () => { alert: AndonAlert; ageMs: number }[];
  acknowledge(alert: AndonAlert): void;
  startResolve(alert: AndonAlert): void;
  confirmResolve(alert: AndonAlert): void;
  resolvingId: () => number | null;
  resolveNote: { setValue(value: string): void };
}

function setup(inputs: { canAct: boolean; kiosk: boolean }, alerts: AndonAlert[] = [alert(1), alert(5, { status: 'Acknowledged' })]) {
  const andon = {
    getOpenAlerts: vi.fn(() => of(alerts)),
    acknowledge: vi.fn(() => of(undefined)),
    resolve: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AndonService, useValue: andon },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new AndonBoardComponent());
  mockSignalInputs(component, inputs);
  const board = component as unknown as BoardInternals;
  board.ngOnInit();
  return { board, andon };
}

describe('AndonBoardComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the open alerts oldest first with their age', () => {
    const { board, andon } = setup({ canAct: true, kiosk: false });

    expect(andon.getOpenAlerts).toHaveBeenCalledWith(false);
    expect(board.rows().map(r => r.alert.id)).toEqual([5, 1]);
    expect(board.rows()[0].ageMs).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
  });

  it('reads through the kiosk terminal endpoint on the kiosk display', () => {
    const { andon } = setup({ canAct: false, kiosk: true });

    expect(andon.getOpenAlerts).toHaveBeenCalledWith(true);
  });

  it('acknowledges an active alert and reloads', () => {
    const { board, andon } = setup({ canAct: true, kiosk: true });

    board.acknowledge(board.rows()[1].alert);

    expect(andon.acknowledge).toHaveBeenCalledWith(1);
    expect(andon.getOpenAlerts).toHaveBeenCalledTimes(2);
  });

  it('does not acknowledge one already acknowledged', () => {
    const { board, andon } = setup({ canAct: true, kiosk: false });

    board.acknowledge(board.rows()[0].alert);

    expect(andon.acknowledge).not.toHaveBeenCalled();
  });

  it('resolves with the note typed', () => {
    const { board, andon } = setup({ canAct: true, kiosk: false });
    const target = board.rows()[0].alert;

    board.startResolve(target);
    expect(board.resolvingId()).toBe(5);
    board.resolveNote.setValue('  Cleared the jam  ');
    board.confirmResolve(target);

    expect(andon.resolve).toHaveBeenCalledWith(5, 'Cleared the jam');
    expect(board.resolvingId()).toBeNull();
  });

  it('takes no action when nobody signed in is allowed to act', () => {
    const { board, andon } = setup({ canAct: false, kiosk: true });

    board.acknowledge(board.rows()[1].alert);
    board.startResolve(board.rows()[0].alert);
    board.confirmResolve(board.rows()[0].alert);

    expect(andon.acknowledge).not.toHaveBeenCalled();
    expect(andon.resolve).not.toHaveBeenCalled();
    expect(board.resolvingId()).toBeNull();
  });
});
