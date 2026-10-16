import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ScanLogEntry } from '../../../../shared/models/scan-log.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanUndoListComponent } from './scan-undo-list.component';

const MOVE: ScanLogEntry = {
  id: 9,
  actionType: 'Move',
  userName: 'Operator',
  partNumber: 'P-1',
  quantity: 3,
  fromLocation: 'A-1',
  toLocation: 'B-2',
  relatedEntity: null,
  isReversed: false,
  createdAt: new Date('2026-10-08T10:00:00Z'),
};

function setup(
  reverse: ScanActionService['reverseScanAction'],
  getScanLog: ScanActionService['getScanLog'] = vi.fn(() => of([])),
) {
  const open = vi.fn((_component: unknown, _config: unknown) => ({ afterClosed: () => of('1234') }));
  const success = vi.fn();
  const error = vi.fn();
  const errorFrom = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { getScanLog, reverseScanAction: reverse } },
      { provide: SnackbarService, useValue: { success, error, errorFrom } },
      { provide: MatDialog, useValue: { open } },
      {
        provide: TranslateService,
        useValue: {
          instant: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : `es:${key}`,
        },
      },
    ],
  });
  const list = TestBed.runInInjectionContext(() => new ScanUndoListComponent());
  return { list, open, success, error, errorFrom };
}

describe('ScanUndoListComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('asks for the PIN and confirms the reversal in the catalog wording', () => {
    const { list, open, success } = setup(vi.fn(() => of(undefined)));
    list.reverseEntry(MOVE);

    expect(open.mock.calls[0][1]).toMatchObject({ data: { title: 'es:kioskFlows.pin.title' } });
    const movedBack = 'kioskFlows.undo.movedBackTo {"location":"A-1"}';
    expect(success).toHaveBeenCalledWith(
      `kioskFlows.undo.reversedToast ${JSON.stringify({ description: `3× P-1 ${movedBack}` })}`,
    );
  });

  it('hands a failed reversal to errorFrom with the catalog fallback', () => {
    const err = new Error('403');
    const { list, error, errorFrom } = setup(vi.fn(() => throwError(() => err)));
    list.reverseEntry(MOVE);

    expect(errorFrom).toHaveBeenCalledWith(err, 'kioskFlows.undo.reverseFailed');
    expect(error).not.toHaveBeenCalled();
  });

  it('labels the action type from the catalog', () => {
    const { list } = setup(vi.fn());

    expect(list.actionTypeLabel('CycleCount')).toBe('es:kioskFlows.logActions.cycleCount');
    expect(list.actionTypeLabel('Teleport')).toBe('Teleport');
  });

  describe('loading the recent actions', () => {
    afterEach(() => vi.useRealTimers());

    it('lists entries whose time arrives as a Date and offers Reverse for them', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 16, 12, 0));
      const oneHourAgo = { ...MOVE, createdAt: new Date(2026, 9, 16, 11, 0) };
      const yesterday = { ...MOVE, id: 10, createdAt: new Date(2026, 9, 15, 11, 0) };
      const { list } = setup(vi.fn(), vi.fn(() => of([oneHourAgo, yesterday])));

      list.ngOnInit();

      expect(list.loading()).toBe(false);
      expect(list.recentEntries().map(e => e.id)).toEqual([9]);
      expect(list.todayCount()).toBe(1);
    });

    it('also asks for the earlier day when the look-back window starts before it', () => {
      vi.useFakeTimers();
      const now = new Date(2026, 9, 16, 2, 0);
      vi.setSystemTime(now);
      const getScanLog = vi.fn(() => of([]));
      const { list } = setup(vi.fn(), getScanLog);

      list.ngOnInit();

      const requested = getScanLog.mock.calls.map(call => (call as unknown[])[1]);
      const lookbackDay = new Date(now.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);
      expect(requested).toContain(lookbackDay);
      expect(requested).toContain(now.toISOString().slice(0, 10));
    });
  });
});
