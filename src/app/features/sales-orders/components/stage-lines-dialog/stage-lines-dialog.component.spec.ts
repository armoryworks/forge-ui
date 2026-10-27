import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormControl } from '@angular/forms';
import { Signal } from '@angular/core';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { SalesOrderStage } from '../../models/sales-order-stage.model';
import { StageLineAllocationRow } from '../../models/stage-line-allocation-row.model';
import { StageLinesDialogComponent } from './stage-lines-dialog.component';

interface DialogInternals {
  ngOnInit(): void;
  rows: Signal<StageLineAllocationRow[]>;
  quantities: FormArray<FormControl<number | null>>;
  violations: Signal<string[]>;
  save(): void;
}

function stage(id: number, lines: { salesOrderLineId: number; quantity: number }[]): SalesOrderStage {
  return {
    id, sequence: id, name: `S${id}`, status: 'Planned', plannedProductionComplete: null, plannedShipDate: null, actualShipDate: null,
    shipmentId: null, shipmentNumber: null, paymentMilestoneId: null, paymentMilestoneName: null, notes: null,
    lines: lines.map((l, i) => ({ id: i + 1, salesOrderLineId: l.salesOrderLineId, partNumber: null, description: 'x', quantity: l.quantity })),
    lots: [],
  };
}

const LINES = [
  { id: 11, lineNumber: 1, partNumber: 'P-1', description: 'Bracket', quantity: 10, shipsGoods: true },
  { id: 12, lineNumber: 2, partNumber: null, description: 'Freight', quantity: 1, lineType: 'Freight' },
] as SalesOrderLine[];

function create(assignStageLines = vi.fn(() => of(stage(1, [])))): DialogInternals {
  TestBed.configureTestingModule({
    providers: [
      { provide: SalesOrderService, useValue: { assignStageLines } },
      { provide: TranslateService, useValue: { instant: (key: string, p?: Record<string, unknown>) => `${key}:${JSON.stringify(p ?? {})}` } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new StageLinesDialogComponent());
  const mine = stage(1, [{ salesOrderLineId: 11, quantity: 2 }]);
  mockSignalInputs(component, { stage: mine, stages: [mine, stage(2, [{ salesOrderLineId: 11, quantity: 6 }])], lines: LINES });
  const dialog = component as unknown as DialogInternals;
  dialog.ngOnInit();
  return dialog;
}

describe('StageLinesDialogComponent', () => {
  it('lists goods lines with what other stages hold and starts from this stage\'s allocation', () => {
    const dialog = create();
    expect(dialog.rows()).toEqual([{ salesOrderLineId: 11, lineNumber: 1, label: 'P-1 — Bracket', ordered: 10, elsewhere: 6, available: 4 }]);
    expect(dialog.quantities.at(0).value).toBe(2);
  });

  it('refuses a quantity that would take the line over what it ordered', () => {
    const assign = vi.fn(() => of(stage(1, [])));
    const dialog = create(assign);
    dialog.quantities.at(0).setValue(5);

    expect(dialog.quantities.invalid).toBe(true);
    expect(dialog.violations()).toHaveLength(1);
    dialog.save();
    expect(assign).not.toHaveBeenCalled();
  });

  it('saves the split quantities', () => {
    const assign = vi.fn(() => of(stage(1, [])));
    const dialog = create(assign);
    dialog.quantities.at(0).setValue(4);
    dialog.save();
    expect(assign).toHaveBeenCalledWith(1, [{ salesOrderLineId: 11, quantity: 4 }]);
  });
});
