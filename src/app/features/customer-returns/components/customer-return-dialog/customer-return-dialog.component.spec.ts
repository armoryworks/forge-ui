import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { CustomerReturnService } from '../../services/customer-return.service';
import { CustomerReturnDetail } from '../../models/customer-return-detail.model';
import { CustomerReturnDialogComponent } from './customer-return-dialog.component';
import { ChannelReturnOrder } from '../../models/channel-return-order.model';
import { CapabilityService } from '../../../../shared/services/capability.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type DialogInternals = {
  returnForm: FormGroup;
  dialogRef: { clearDraft(): void };
  save(): void;
  jobFilters(): Record<string, string>;
};

describe('CustomerReturnDialogComponent quantity', () => {
  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    create = vi.fn(() => of({ id: 3 } as CustomerReturnDetail));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: CustomerReturnService, useValue: { create, update: vi.fn() } },
      ],
    });
  });

  function dialog(): DialogInternals {
    const d = TestBed.runInInjectionContext(() => new CustomerReturnDialogComponent()) as unknown as DialogInternals;
    d.dialogRef = { clearDraft: () => undefined };
    return d;
  }

  it('lets the original job picker reach archived jobs', () => {
    expect(dialog().jobFilters()['includeArchived']).toBe('true');
  });

  it('requires a positive quantity on a new return', () => {
    const d = dialog();
    d.returnForm.patchValue({ customerId: 1, originalJobId: 2, reason: 'Cracked', returnDate: new Date(2026, 9, 1) });
    expect(d.returnForm.valid).toBe(false);
    d.returnForm.patchValue({ quantity: 0 });
    expect(d.returnForm.valid).toBe(false);
    d.returnForm.patchValue({ quantity: 2 });
    expect(d.returnForm.valid).toBe(true);
  });

  it('sends the returned quantity when the return is created', () => {
    const d = dialog();
    d.returnForm.patchValue({ customerId: 1, originalJobId: 2, reason: 'Cracked', quantity: 2.5, returnDate: new Date(2026, 9, 1) });

    d.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 1, originalJobId: 2, quantity: 2.5 }));
  });

  it('asks for a rework work order only when the toggle is on', () => {
    const d = dialog();
    d.returnForm.patchValue({ customerId: 1, originalJobId: 2, reason: 'Cracked', quantity: 3, returnDate: new Date(2026, 9, 1) });
    d.save();
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ createReworkJob: false }));

    d.returnForm.patchValue({ createReworkJob: true });
    d.save();
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ createReworkJob: true, quantity: 3 }));
  });
});

describe('CustomerReturnDialogComponent channel source', () => {
  let createChannel: ReturnType<typeof vi.fn>;
  let getChannelOrders: ReturnType<typeof vi.fn>;
  const order: ChannelReturnOrder = {
    salesOrderId: 70, orderNumber: 'SO-70', externalOrderNumber: 'AMZ-1', channelId: 2, channelName: 'Marketplace',
    buyerName: 'Jordan Buyer', customerName: 'House', createdAt: '2026-10-01T00:00:00Z',
    lines: [{ id: 701, lineNumber: 1, partNumber: 'W-1', description: 'Widget', quantity: 2, shippedQuantity: 2, unitPrice: 9 }],
  };

  type ChannelInternals = DialogInternals & {
    sourceControl: { setValue(v: 'Direct' | 'Channel'): void };
    canUseChannel(): boolean;
    selectedOrder(): ChannelReturnOrder | null;
  };

  function dialog(retailOn = true): ChannelInternals {
    createChannel = vi.fn(() => of({ id: 9 }));
    getChannelOrders = vi.fn(() => of([order]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: CustomerReturnService, useValue: { create: vi.fn(), update: vi.fn(), createChannel, getChannelOrders } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code !== 'CAP-O2C-RETAIL' || retailOn } },
      ],
    });
    const d = TestBed.runInInjectionContext(() => new CustomerReturnDialogComponent()) as unknown as ChannelInternals;
    d.dialogRef = { clearDraft: () => undefined };
    return d;
  }

  it('records a channel return against the picked order without a job', () => {
    const d = dialog();
    d.sourceControl.setValue('Channel');

    expect(getChannelOrders).toHaveBeenCalled();
    expect(d.returnForm.get('originalJobId')!.disabled).toBe(true);
    d.returnForm.patchValue({ salesOrderId: 70 });
    expect(d.selectedOrder()?.buyerName).toBe('Jordan Buyer');
    expect(d.returnForm.get('salesOrderLineId')!.value).toBe(701);
    d.returnForm.patchValue({ reason: 'Buyer changed mind', externalRmaId: 'R-55', refundAmount: 18, returnDate: new Date(2026, 9, 20) });
    expect(d.returnForm.valid).toBe(true);

    d.save();

    expect(createChannel).toHaveBeenCalledWith(expect.objectContaining({
      salesOrderId: 70, salesOrderLineId: 701, externalRmaId: 'R-55', reason: 'Buyer changed mind', refundAmount: 18,
    }));
  });

  it('needs a channel order before it can save', () => {
    const d = dialog();
    d.sourceControl.setValue('Channel');
    d.returnForm.patchValue({ reason: 'Damaged', returnDate: new Date(2026, 9, 20) });

    expect(d.returnForm.valid).toBe(false);
  });

  it('offers no channel source when retail orders are off', () => {
    expect(dialog(false).canUseChannel()).toBe(false);
    expect(dialog(true).canUseChannel()).toBe(true);
  });
});
