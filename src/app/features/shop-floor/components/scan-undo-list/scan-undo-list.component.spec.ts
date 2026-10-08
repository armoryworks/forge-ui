import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  createdAt: '2026-10-08T10:00:00Z',
};

function setup(reverse: ScanActionService['reverseScanAction']) {
  const open = vi.fn((_component: unknown, _config: unknown) => ({ afterClosed: () => of('1234') }));
  const success = vi.fn();
  const error = vi.fn();
  const errorFrom = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { getScanLog: vi.fn(() => of([])), reverseScanAction: reverse } },
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
});
