import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { RfqDetailDialogComponent } from './rfq-detail-dialog.component';
import { PurchasingService } from '../../services/purchasing.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { RfqDetail, RfqVendorResponse } from '../../models/rfq.model';
import { ConfirmSendService } from '../../../../shared/services/confirm-send.service';
import { SnackbarNavOptions, SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  awardVendor(response: RfqVendorResponse): void;
  responseForm: { controls: Record<string, { setValue(v: unknown): void; valid: boolean }> };
}

const response: RfqVendorResponse = {
  id: 5, rfqId: 3, vendorId: 9, vendorName: 'Larkfen Polymers', responseStatus: 'Received',
  unitPrice: 2.5, leadTimeDays: 10, minimumOrderQuantity: 100, toolingCost: null, quoteValidUntil: null,
  notes: null, invitedAt: null, respondedAt: null, isAwarded: false, declineReason: null,
};

const rfq = {
  id: 3, rfqNumber: 'RFQ-20261019-002', vendorResponses: [response],
} as unknown as RfqDetail;

function setup() {
  const close = vi.fn();
  const successWithNav = vi.fn();
  const awardRfq = vi.fn(() => of({ purchaseOrderId: 8 }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: { rfqId: 3 } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
      { provide: PurchasingService, useValue: { getRfqById: () => of(rfq), awardRfq } },
      { provide: VendorService, useValue: { getVendorDropdown: () => of([]) } },
      { provide: ConfirmSendService, useValue: { confirmSend: () => of(false) } },
      { provide: SnackbarService, useValue: { successWithNav, success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new RfqDetailDialogComponent());
  return { internals: component as unknown as DialogInternals, close, successWithNav, awardRfq };
}

describe('RfqDetailDialogComponent', () => {
  it('links the award snackbar to the new purchase order and closes the RFQ dialog when followed', () => {
    const { internals, close, successWithNav, awardRfq } = setup();

    internals.awardVendor(response);

    expect(awardRfq).toHaveBeenCalledWith(3, 5);
    const [, route, , options] = successWithNav.mock.calls[0] as [string, string, string, SnackbarNavOptions];
    expect(route).toBe('/purchase-orders/orders');
    expect(options.queryParams).toEqual({ detail: 'purchase-order:8' });
    expect(close).not.toHaveBeenCalled();
    options.beforeNavigate?.();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('rejects negative vendor response figures and a zero minimum order', () => {
    const { internals } = setup();
    const controls = internals.responseForm.controls;

    controls['unitPrice'].setValue(-12.345);
    controls['leadTimeDays'].setValue(-3);
    controls['minimumOrderQuantity'].setValue(0);
    controls['toolingCost'].setValue(-100);

    expect(controls['unitPrice'].valid).toBe(false);
    expect(controls['leadTimeDays'].valid).toBe(false);
    expect(controls['minimumOrderQuantity'].valid).toBe(false);
    expect(controls['toolingCost'].valid).toBe(false);
  });
});
