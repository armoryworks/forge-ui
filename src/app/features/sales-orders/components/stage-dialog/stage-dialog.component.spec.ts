import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderStage } from '../../models/sales-order-stage.model';
import { StageDialogComponent } from './stage-dialog.component';

interface DialogInternals {
  ngOnInit(): void;
  form: FormGroup<{ name: FormControl<string>; sequence: FormControl<number | null>; plannedShipDate: FormControl<Date | null>; notes: FormControl<string> }>;
  save(): void;
}

function create(stage: SalesOrderStage | null, service: Record<string, unknown>): DialogInternals {
  TestBed.configureTestingModule({
    providers: [
      { provide: SalesOrderService, useValue: service },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new StageDialogComponent());
  mockSignalInputs(component, { salesOrderId: 7, stage, nextSequence: 3 });
  const dialog = component as unknown as DialogInternals;
  dialog.ngOnInit();
  return dialog;
}

describe('StageDialogComponent', () => {
  it('adds a stage at the next sequence', () => {
    const createStage = vi.fn(() => of({}));
    const dialog = create(null, { createStage, updateStage: vi.fn() });
    expect(dialog.form.controls.sequence.value).toBe(3);
    dialog.form.patchValue({ name: ' Second lot ', plannedShipDate: new Date(2026, 11, 1) });
    dialog.save();
    expect(createStage).toHaveBeenCalledWith(7, expect.objectContaining({
      name: 'Second lot', sequence: 3, plannedShipDate: '2026-12-01T00:00:00Z', notes: null,
    }));
  });

  it('edits an existing stage and keeps its payment milestone', () => {
    const updateStage = vi.fn(() => of({}));
    const stage = {
      id: 5, sequence: 1, name: 'First', status: 'Planned', plannedProductionComplete: null, plannedShipDate: null,
      actualShipDate: null, shipmentId: null, shipmentNumber: null, paymentMilestoneId: 9, paymentMilestoneName: 'Deposit',
      notes: null, lines: [], lots: [],
    } as SalesOrderStage;
    const dialog = create(stage, { createStage: vi.fn(), updateStage });
    expect(dialog.form.controls.name.value).toBe('First');
    dialog.save();
    expect(updateStage).toHaveBeenCalledWith(5, expect.objectContaining({ name: 'First', sequence: 1, paymentMilestoneId: 9 }));
  });
});
