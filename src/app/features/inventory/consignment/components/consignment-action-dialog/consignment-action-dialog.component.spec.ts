import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { ConsignmentActionDialogComponent } from './consignment-action-dialog.component';
import { ConsignmentService } from '../../services/consignment.service';
import { InventoryService } from '../../../services/inventory.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface DialogInternals {
  form: { patchValue(v: Record<string, unknown>): void };
  reconcileForm: { patchValue(v: Record<string, unknown>): void };
  result(): { vendorBillNumber: string | null } | null;
  done: { subscribe(fn: () => void): void };
  submit(): void;
  ngOnInit(): void;
}

describe('ConsignmentActionDialogComponent', () => {
  const service = { receive: vi.fn(), consume: vi.fn(), reconcile: vi.fn() };
  const stock = { agreementId: 5, partNumber: 'BOLT', ownerName: 'Bolt Supply', onHandQuantity: 10 };

  function build(action: string): DialogInternals {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsignmentService, useValue: service },
        { provide: InventoryService, useValue: { getAllActiveBinLocations: () => of([{ id: 2, name: 'Line', locationPath: 'Line' }]) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new ConsignmentActionDialogComponent()) as unknown as DialogInternals;
    Object.assign(dialog, { action: () => action, stock: () => stock });
    dialog.ngOnInit();
    return dialog;
  }

  beforeEach(() => Object.values(service).forEach(fn => fn.mockReset()));

  it('receives into the chosen bin with the lot', () => {
    service.receive.mockReturnValue(of({}));
    const dialog = build('receive');
    dialog.form.patchValue({ quantity: 50, storageLocationId: 2, lotNumber: 'L1', jobId: 9 });
    dialog.submit();
    expect(service.receive).toHaveBeenCalledWith(5, expect.objectContaining({ quantity: 50, storageLocationId: 2, lotNumber: 'L1', jobId: null }));
  });

  it('consumes to a job', () => {
    service.consume.mockReturnValue(of({}));
    const dialog = build('consume');
    dialog.form.patchValue({ quantity: 4, jobId: 9 });
    dialog.submit();
    expect(service.consume).toHaveBeenCalledWith(5, expect.objectContaining({ quantity: 4, jobId: 9, lotNumber: null }));
  });

  it('reconciles a period and shows the drafted bill', () => {
    service.reconcile.mockReturnValue(of({ vendorBillId: 3, vendorBillNumber: 'BILL-1003', consumedQuantity: 4, billingAvailable: true, variance: 0 }));
    const dialog = build('reconcile');
    const done = vi.fn();
    dialog.done.subscribe(done);
    dialog.reconcileForm.patchValue({ periodFrom: new Date(2026, 9, 1), periodTo: new Date(2026, 9, 31), vendorInvoiceNumber: 'INV-7' });

    dialog.submit();

    expect(service.reconcile).toHaveBeenCalledWith(5, {
      physicalCount: null, periodFrom: '2026-10-01', periodTo: '2026-10-31', createBill: true, vendorInvoiceNumber: 'INV-7',
    });
    expect(dialog.result()?.vendorBillNumber).toBe('BILL-1003');
    expect(done).toHaveBeenCalled();
  });
});
