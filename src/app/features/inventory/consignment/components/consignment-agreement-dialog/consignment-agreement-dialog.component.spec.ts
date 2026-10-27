import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { ConsignmentAgreementDialogComponent } from './consignment-agreement-dialog.component';
import { ConsignmentService } from '../../services/consignment.service';

interface DialogInternals {
  form: { patchValue(v: Record<string, unknown>): void; invalid: boolean; controls: { vendorId: { disabled: boolean } } };
  saved: { subscribe(fn: (v: unknown) => void): void };
  submit(): void;
  ngOnInit(): void;
}

describe('ConsignmentAgreementDialogComponent', () => {
  const service = { create: vi.fn(), update: vi.fn() };

  function build(agreement: unknown): DialogInternals {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsignmentService, useValue: service },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new ConsignmentAgreementDialogComponent()) as unknown as DialogInternals;
    Object.assign(dialog, { agreement: () => agreement });
    dialog.ngOnInit();
    return dialog;
  }

  beforeEach(() => Object.values(service).forEach(fn => fn.mockReset()));

  it('creates an inbound vendor agreement', () => {
    service.create.mockReturnValue(of({ id: 4 }));
    const dialog = build(null);
    dialog.form.patchValue({ vendorId: 8, partId: 3, agreedUnitPrice: 2.5, minStockQuantity: 20, effectiveFrom: new Date(2026, 0, 1) });

    dialog.submit();

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'Inbound', vendorId: 8, partId: 3, agreedUnitPrice: 2.5, minStockQuantity: 20, effectiveFrom: '2026-01-01',
    }));
  });

  it('edits the terms of an existing agreement without its vendor or part', () => {
    service.update.mockReturnValue(of({ id: 4 }));
    const dialog = build({
      id: 4, vendorId: 8, vendorName: 'Bolt Supply', partId: 3, partNumber: 'BOLT', agreedUnitPrice: 2.5, minStockQuantity: null,
      maxStockQuantity: null, effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null, invoiceOnConsumption: true,
      reconciliationFrequencyDays: 30, status: 'Active', terms: null,
    });
    expect(dialog.form.controls.vendorId.disabled).toBe(true);
    dialog.form.patchValue({ agreedUnitPrice: 3, status: 'Suspended' });

    dialog.submit();

    expect(service.update).toHaveBeenCalledWith(4, expect.objectContaining({ agreedUnitPrice: 3, status: 'Suspended' }));
    expect(service.update.mock.calls[0][1]).not.toHaveProperty('vendorId');
  });
});
