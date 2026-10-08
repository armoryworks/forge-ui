import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal, WritableSignal, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';

import { SalesOrderDetailPanelComponent } from './sales-order-detail-panel.component';
import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderAcceptanceService } from '../../services/sales-order-acceptance.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AccountingService } from '../../../../shared/services/accounting.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SalesOrderDetail } from '../../models/sales-order-detail.model';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { SalesOrderAcceptance } from '../../models/sales-order-acceptance.model';

function line(overrides: Partial<SalesOrderLine> = {}): SalesOrderLine {
  return {
    id: 11,
    partId: 3,
    partNumber: 'P-100',
    description: 'Bracket',
    quantity: 10,
    unitPrice: 12.5,
    lineTotal: 125,
    lineNumber: 1,
    shippedQuantity: 0,
    remainingQuantity: 10,
    isFullyShipped: false,
    notes: null,
    jobs: [],
    ...overrides,
  };
}

function order(overrides: Partial<SalesOrderDetail> = {}): SalesOrderDetail {
  return {
    id: 7,
    orderNumber: 'SO-00007',
    customerId: 4,
    customerName: 'Acme',
    quoteId: null,
    quoteNumber: null,
    shippingAddressId: 21,
    billingAddressId: 22,
    status: 'Draft',
    creditTerms: null,
    confirmedDate: null,
    requestedDeliveryDate: new Date('2026-11-01'),
    customerPO: null,
    notes: null,
    taxRate: 0.0725,
    subtotal: 125,
    taxAmount: 9.06,
    total: 134.06,
    lines: [line()],
    shipments: [],
    returns: [],
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
    ...overrides,
  };
}

interface Panel {
  so: WritableSignal<SalesOrderDetail | null>;
  canEditHeader: Signal<boolean>;
  canEditOrderNumber: Signal<boolean>;
  canEditLines(status: string): boolean;
  canCancel(status: string): boolean;
  confirmSo(): void;
  loadDetail(id: number): void;
  creditHold: Signal<boolean>;
  creditHoldMessage: Signal<string>;
  showCreditHoldBanner: Signal<boolean>;
  confirmTooltip: Signal<string>;
  startEditHeader(): void;
  showShipTo: Signal<boolean>;
  showBillTo: Signal<boolean>;
  confirmDisabled: Signal<boolean>;
  shippingAddress: Signal<CustomerAddress | null>;
  billingAddress: Signal<CustomerAddress | null>;
  formatAddress(address: CustomerAddress): string;
  linesWithNoJobs: Signal<SalesOrderLine[]>;
  linesNeedingWorkOrders: Signal<SalesOrderLine[]>;
  canCreateWorkOrder(line: SalesOrderLine): boolean;
  createWorkOrders(line?: SalesOrderLine): void;
  cancelMessage: Signal<string>;
  taxPercent: Signal<number>;
  acceptedBannerKey(acceptance: SalesOrderAcceptance): string;
  cancelSo(): void;
  submitCancel(): void;
  showCancelDialog: Signal<boolean>;
  cancelFeeAllowed: Signal<boolean>;
  cancelForm: { setValue(value: { feeAmount: number | null; feeReason: string }): void };
  hasOpenLinkedJobs: Signal<boolean>;
  headerForm: FormGroup;
  headerTaxLocked: Signal<boolean>;
  headerError: Signal<string | null>;
  editingHeader: Signal<boolean>;
  saveHeader(): void;
}

describe('SalesOrderDetailPanelComponent', () => {
  let soService: Record<string, ReturnType<typeof vi.fn>>;
  let customerService: { getCreditStatus: ReturnType<typeof vi.fn>; getTaxEditability: ReturnType<typeof vi.fn> };
  let snackbar: Record<string, ReturnType<typeof vi.fn>>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let dialogResult: boolean;
  let enabledCaps: Set<string>;
  let standalone: WritableSignal<boolean>;

  function build(detail: SalesOrderDetail): Panel {
    const panel = TestBed.runInInjectionContext(() => new SalesOrderDetailPanelComponent()) as unknown as Panel;
    panel['so'].set(detail);
    return panel;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    dialogResult = true;
    enabledCaps = new Set();
    standalone = signal(true);
    soService = {
      getSalesOrderById: vi.fn(() => of(order())),
      getDocuments: vi.fn(() => of([])),
      getInvoices: vi.fn(() => of([])),
      getCustomerAddresses: vi.fn(() => of([])),
      confirmSalesOrder: vi.fn(() => of({ jobsCreated: 2 })),
      createMissingJobs: vi.fn(() => of({ created: 1, skipped: [] })),
      cancelSalesOrder: vi.fn(() => of(undefined)),
      updateSalesOrder: vi.fn(() => of(undefined)),
    };
    customerService = {
      getCreditStatus: vi.fn(),
      getTaxEditability: vi.fn(() => of({ canEditTax: false, reason: null, activeDocumentId: null, stateCode: 'UT', expiresAt: null })),
    };
    snackbar = { success: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));

    TestBed.configureTestingModule({
      providers: [
        { provide: SalesOrderService, useValue: soService },
        { provide: SalesOrderAcceptanceService, useValue: { list: vi.fn(() => of([])) } },
        { provide: CustomerService, useValue: customerService },
        { provide: SnackbarService, useValue: snackbar },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        {
          provide: TranslateService,
          useValue: { instant: (key: string, params?: object) => (params ? `${key} ${JSON.stringify(params)}` : key) },
        },
        { provide: AccountingService, useValue: { isStandalone: standalone } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => enabledCaps.has(code) } },
        { provide: AuthService, useValue: { hasRole: () => false } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => true } },
      ],
    });
  });

  it('lets the header be edited while Draft or Confirmed but keeps the number Draft-only', () => {
    const panel = build(order({ status: 'Confirmed' }));
    expect(panel['canEditHeader']()).toBe(true);
    expect(panel['canEditOrderNumber']()).toBe(false);
    expect(panel['canEditLines']('Confirmed')).toBe(false);

    panel['so'].set(order({ status: 'Draft' }));
    expect(panel['canEditHeader']()).toBe(true);
    expect(panel['canEditOrderNumber']()).toBe(true);

    panel['so'].set(order({ status: 'Shipped' }));
    expect(panel['canEditHeader']()).toBe(false);
  });

  it('allows cancelling a partially shipped order', () => {
    const panel = build(order());
    expect(panel['canCancel']('PartiallyShipped')).toBe(true);
    expect(panel['canCancel']('Shipped')).toBe(false);
  });

  it('previews the confirm with the non-blocking warnings, then reports the work orders made', () => {
    const panel = build(order({
      shippingAddressId: null,
      requestedDeliveryDate: null,
      lines: [line(), line({ id: 12, lineNumber: 2, unitPrice: 0 }), line({ id: 13, lineNumber: 3, partId: null, unitPrice: 0 })],
    }));

    panel['confirmSo']();

    const data = dialogOpen.mock.calls[0][1].data as ConfirmDialogData;
    expect(data.message).toBe('salesOrders.confirmSoReleaseMessage {"number":"SO-00007","count":2}');
    expect(data.details).toEqual([
      'salesOrders.confirmWarnZeroPrice {"count":2}',
      'salesOrders.confirmWarnNoShipTo',
      'salesOrders.confirmWarnNoDate',
    ]);
    expect(soService['confirmSalesOrder']).toHaveBeenCalledWith(7);
    expect(snackbar['success']).toHaveBeenCalledWith('salesOrders.soConfirmedWithJobs {"number":"SO-00007","count":2}');
  });

  it('lists no warnings for a complete order', () => {
    const panel = build(order());
    panel['confirmSo']();
    expect((dialogOpen.mock.calls[0][1].data as ConfirmDialogData).details).toEqual([]);
  });

  it('warns when the confirm made no work orders', () => {
    soService['confirmSalesOrder'].mockReturnValue(of({ jobsCreated: 0 }));
    const panel = build(order());
    panel['confirmSo']();
    expect(snackbar['warn']).toHaveBeenCalledWith('salesOrders.soConfirmedNoJobs');
    expect(snackbar['success']).not.toHaveBeenCalled();
  });

  it('does not confirm when the preview is dismissed', () => {
    dialogResult = false;
    const panel = build(order());
    panel['confirmSo']();
    expect(soService['confirmSalesOrder']).not.toHaveBeenCalled();
  });

  it('blocks confirm while the customer is on credit hold', () => {
    enabledCaps.add('CAP-O2C-CREDIT-LIMITS');
    customerService.getCreditStatus.mockReturnValue(of({ isOnHold: true, holdReason: 'Past due' }));
    const panel = build(order());
    panel['loadDetail'](7);

    expect(customerService.getCreditStatus).toHaveBeenCalledWith(4);
    expect(panel['creditHold']()).toBe(true);
    expect(panel['confirmDisabled']()).toBe(true);
    expect(panel['creditHoldMessage']()).toBe('salesOrders.creditHoldWarning {"reason":"Past due"}');

    panel['confirmSo']();
    expect(dialogOpen).not.toHaveBeenCalled();
  });

  it('words the credit hold without a reason and past Draft', () => {
    enabledCaps.add('CAP-O2C-CREDIT-LIMITS');
    customerService.getCreditStatus.mockReturnValue(of({ isOnHold: true, holdReason: null }));
    const panel = build(order());
    panel['loadDetail'](7);
    expect(panel['creditHoldMessage']()).toBe('salesOrders.creditHoldWarningNoReason');

    panel['so'].set(order({ status: 'Confirmed' }));
    expect(panel['creditHoldMessage']()).toBe('salesOrders.creditHoldWarningOpenNoReason');
  });

  it('explains the credit hold on the disabled Confirm', () => {
    enabledCaps.add('CAP-O2C-CREDIT-LIMITS');
    customerService.getCreditStatus.mockReturnValue(of({ isOnHold: true, holdReason: 'Past due' }));
    const panel = build(order());
    panel['loadDetail'](7);
    expect(panel['confirmTooltip']()).toBe('salesOrders.creditHoldWarning {"reason":"Past due"}');
  });

  it('shows the credit hold banner only while the order can still ship', () => {
    enabledCaps.add('CAP-O2C-CREDIT-LIMITS');
    customerService.getCreditStatus.mockReturnValue(of({ isOnHold: true, holdReason: null }));
    const panel = build(order());
    panel['loadDetail'](7);

    for (const status of ['Draft', 'Confirmed', 'InProduction', 'PartiallyShipped']) {
      panel['so'].set(order({ status }));
      expect(panel['showCreditHoldBanner']()).toBe(true);
    }
    for (const status of ['Shipped', 'Completed', 'Cancelled']) {
      panel['so'].set(order({ status }));
      expect(panel['showCreditHoldBanner']()).toBe(false);
    }
  });

  it('skips the credit check when credit limits are off', () => {
    const panel = build(order());
    panel['loadDetail'](7);
    expect(customerService.getCreditStatus).not.toHaveBeenCalled();
    expect(panel['confirmDisabled']()).toBe(false);
  });

  it('shows the ship-to and bill-to from the customer addresses', () => {
    const address = { id: 21, label: 'Dock 2', addressType: 'Shipping', line1: '1 Main St', city: 'Ogden', state: 'UT', postalCode: '84401', country: 'US', isDefault: true };
    soService['getCustomerAddresses'].mockReturnValue(of([address]));
    const panel = build(order());
    panel['loadDetail'](7);
    expect(panel['shippingAddress']()).toEqual(address);
    expect(panel['billingAddress']()).toBeNull();
    expect(panel['formatAddress'](address)).toBe('Dock 2, 1 Main St, Ogden UT 84401');
  });

  it('fetches the customer addresses once across reloads', () => {
    const panel = build(order());
    panel['loadDetail'](7);
    panel['loadDetail'](7);
    expect(soService['getCustomerAddresses']).toHaveBeenCalledTimes(1);
  });

  it('refetches the customer addresses when the header edit opens', () => {
    const panel = build(order());
    panel['loadDetail'](7);
    panel['startEditHeader']();
    expect(soService['getCustomerAddresses']).toHaveBeenCalledTimes(2);
  });

  it('hides an address row whose address cannot be resolved', () => {
    const panel = build(order({ shippingAddressId: 21, billingAddressId: null }));
    panel['loadDetail'](7);
    panel['so'].set(order({ shippingAddressId: 21, billingAddressId: null }));
    expect(panel['showShipTo']()).toBe(false);
    expect(panel['showBillTo']()).toBe(true);
  });

  it('shows the tax rate as a percentage', () => {
    const panel = build(order({ taxRate: 0.0725 }));
    expect(panel['taxPercent']()).toBe(7.25);
  });

  it('uses the no-name acceptance banner when nobody was recorded', () => {
    const panel = build(order());
    const acceptance = { acceptedByName: null, recordedByName: null } as unknown as SalesOrderAcceptance;
    expect(panel['acceptedBannerKey'](acceptance)).toBe('salesOrders.acceptance.acceptedBannerNoName');
    expect(panel['acceptedBannerKey']({ ...acceptance, recordedByName: 'Pat' })).toBe('salesOrders.acceptance.acceptedBanner');
  });

  it('creates the work order for one flagged line and reloads the order', () => {
    soService['createMissingJobs'].mockReturnValue(of({ created: 0, skipped: [{ lineNumber: 2, reason: 'No part on this line' }] }));
    const flagged = line({ id: 12, lineNumber: 2 });
    const panel = build(order({ status: 'Confirmed', lines: [line({ jobs: [{ id: 1 } as never] }), flagged] }));
    expect(panel['linesWithNoJobs']()).toEqual([flagged]);

    panel['createWorkOrders'](flagged);

    expect(soService['createMissingJobs']).toHaveBeenCalledWith(7, 12);
    expect(soService['getSalesOrderById']).toHaveBeenCalledWith(7);
    expect(snackbar['warn']).toHaveBeenCalledWith('salesOrders.workOrderSkippedLine {"line":2,"reason":"salesOrders.workOrderSkipNoPart"}');
    expect(snackbar['success']).not.toHaveBeenCalled();
  });

  it('translates the already-shipped skip reason', () => {
    soService['createMissingJobs'].mockReturnValue(of({ created: 0, skipped: [{ lineNumber: 1, reason: 'Already shipped' }] }));
    const panel = build(order({ status: 'Confirmed' }));

    panel['createWorkOrders'](line());

    expect(snackbar['warn']).toHaveBeenCalledWith('salesOrders.workOrderSkippedLine {"line":1,"reason":"salesOrders.workOrderSkipAlreadyShipped"}');
  });

  it('creates the work orders for every unlinked line', () => {
    const panel = build(order({ status: 'Confirmed', lines: [line(), line({ id: 12, lineNumber: 2 })] }));

    panel['createWorkOrders']();

    expect(soService['createMissingJobs'].mock.calls).toEqual([[7, 11], [7, 12]]);
    expect(snackbar['success']).toHaveBeenCalledWith('salesOrders.workOrdersCreated {"count":2}');
    expect(snackbar['warn']).not.toHaveBeenCalled();
  });

  it('leaves fully shipped lines out of work order creation on a partially shipped order', () => {
    const shipped = line({ id: 12, lineNumber: 2, isFullyShipped: true, shippedQuantity: 10, remainingQuantity: 0 });
    const open = line({ id: 13, lineNumber: 3 });
    const panel = build(order({ status: 'PartiallyShipped', lines: [shipped, open] }));

    expect(panel['linesNeedingWorkOrders']()).toEqual([open]);
    expect(panel['canCreateWorkOrder'](shipped)).toBe(false);
    expect(panel['canCreateWorkOrder'](open)).toBe(true);

    panel['createWorkOrders']();
    expect(soService['createMissingJobs'].mock.calls).toEqual([[7, 13]]);
  });

  it('offers no work order creation once the order is shipped', () => {
    const unlinked = line();
    const panel = build(order({ status: 'Shipped', lines: [unlinked] }));
    expect(panel['linesWithNoJobs']()).toEqual([unlinked]);
    expect(panel['linesNeedingWorkOrders']()).toEqual([]);
    expect(panel['canCreateWorkOrder'](unlinked)).toBe(false);

    panel['createWorkOrders']();
    expect(soService['createMissingJobs']).not.toHaveBeenCalled();
  });

  it('offers work orders only on lines with a part', () => {
    const make = line();
    const freight = line({ id: 12, lineNumber: 2, partId: null, partNumber: null, description: 'Freight' });
    const panel = build(order({ status: 'Confirmed', lines: [make, freight] }));

    expect(panel['linesWithNoJobs']()).toEqual([make]);
    expect(panel['linesNeedingWorkOrders']()).toEqual([make]);
    expect(panel['canCreateWorkOrder'](make)).toBe(true);
    expect(panel['canCreateWorkOrder'](freight)).toBe(false);

    panel['createWorkOrders']();
    expect(soService['createMissingJobs'].mock.calls).toEqual([[7, 11]]);
  });

  it('says so when nothing was created and nothing was skipped', () => {
    soService['createMissingJobs'].mockReturnValue(of({ created: 0, skipped: [] }));
    const panel = build(order({ status: 'Confirmed' }));
    panel['createWorkOrders']();
    expect(snackbar['info']).toHaveBeenCalledWith('salesOrders.noWorkOrdersCreated');
  });

  it('mentions the hold only when open work orders are linked to unshipped lines', () => {
    const panel = build(order({
      status: 'PartiallyShipped',
      lines: [
        line({ jobs: [{ id: 2, isArchived: true } as never] }),
        line({ id: 12, isFullyShipped: true, jobs: [{ id: 3, isArchived: false } as never] }),
      ],
    }));
    expect(panel['cancelMessage']()).toBe('salesOrders.cancelSoMessageNoJobs {"number":"SO-00007"}');

    panel['so'].set(order({ status: 'Confirmed', lines: [line({ jobs: [{ id: 1, isArchived: false } as never] })] }));
    expect(panel['cancelMessage']()).toBe('salesOrders.cancelSoMessageHold {"number":"SO-00007"}');
  });

  it('cancels with the fee and reason', () => {
    enabledCaps.add('CAP-O2C-INVOICE');
    const panel = build(order({ status: 'Confirmed' }));
    expect(panel['cancelFeeAllowed']()).toBe(true);
    panel['cancelSo']();
    expect(panel['showCancelDialog']()).toBe(true);

    panel['cancelForm'].setValue({ feeAmount: 150, feeReason: ' Material bought ' });
    panel['submitCancel']();

    expect(soService['cancelSalesOrder']).toHaveBeenCalledWith(7, { feeAmount: 150, feeReason: 'Material bought' });
    expect(panel['showCancelDialog']()).toBe(false);
    expect(snackbar['success']).toHaveBeenCalledWith('salesOrders.soCancelled');
  });

  it('cancels without a fee when none is entered', () => {
    const panel = build(order());
    panel['cancelSo']();
    panel['submitCancel']();
    expect(soService['cancelSalesOrder']).toHaveBeenCalledWith(7, {});
  });

  it('cancels without a fee when invoices are kept in the accounting system', () => {
    enabledCaps.add('CAP-O2C-INVOICE');
    standalone.set(false);
    const panel = build(order({ status: 'Confirmed' }));
    expect(panel['cancelFeeAllowed']()).toBe(false);

    panel['cancelSo']();
    panel['cancelForm'].setValue({ feeAmount: 150, feeReason: 'Material bought' });
    panel['submitCancel']();

    expect(soService['cancelSalesOrder']).toHaveBeenCalledWith(7, {});
  });

  it('cancels without a fee when Forge invoicing is off', () => {
    const panel = build(order({ status: 'Confirmed' }));
    expect(panel['cancelFeeAllowed']()).toBe(false);

    panel['cancelSo']();
    panel['cancelForm'].setValue({ feeAmount: 150, feeReason: 'Material bought' });
    panel['submitCancel']();

    expect(soService['cancelSalesOrder']).toHaveBeenCalledWith(7, {});
  });

  it('ignores completed work orders when deciding the cancel puts work on hold', () => {
    const panel = build(order({
      status: 'Confirmed',
      lines: [line({ jobs: [{ id: 1, isArchived: false, isComplete: true } as never] })],
    }));
    expect(panel['hasOpenLinkedJobs']()).toBe(false);
    expect(panel['cancelMessage']()).toBe('salesOrders.cancelSoMessageNoJobs {"number":"SO-00007"}');

    panel['so'].set(order({
      status: 'Confirmed',
      lines: [line({ jobs: [{ id: 1, isArchived: false, isComplete: true } as never, { id: 2, isArchived: false, isComplete: false } as never] })],
    }));
    expect(panel['hasOpenLinkedJobs']()).toBe(true);
  });

  it('loads the requested delivery date into the header edit on the same calendar day', () => {
    const panel = build(order({ requestedDeliveryDate: new Date('2026-10-30T00:00:00Z') }));

    panel['startEditHeader']();

    const loaded = panel['headerForm'].getRawValue().requestedDeliveryDate as Date;
    expect([loaded.getFullYear(), loaded.getMonth(), loaded.getDate()]).toEqual([2026, 9, 30]);
  });

  it('locks the header tax rate without a verified certificate and leaves it out of the save', () => {
    const panel = build(order({ status: 'Confirmed', taxRate: 0.0725 }));

    panel['startEditHeader']();

    expect(customerService.getTaxEditability).toHaveBeenCalledWith(4);
    expect(panel['headerTaxLocked']()).toBe(true);
    expect(panel['headerForm'].get('taxRate')!.disabled).toBe(true);
    expect(panel['headerForm'].getRawValue().taxRate).toBe(7.25);

    panel['saveHeader']();
    expect(soService['updateSalesOrder'].mock.calls[0][1].taxRate).toBeUndefined();
  });

  it('sends a changed tax rate when a verified certificate is on file', () => {
    customerService.getTaxEditability.mockReturnValue(of({ canEditTax: true, reason: null, activeDocumentId: 3, stateCode: 'UT', expiresAt: null }));
    const panel = build(order({ status: 'Confirmed', taxRate: 0.0725 }));

    panel['startEditHeader']();
    expect(panel['headerTaxLocked']()).toBe(false);
    panel['headerForm'].get('taxRate')!.setValue(0);
    panel['saveHeader']();

    expect(soService['updateSalesOrder'].mock.calls[0][1].taxRate).toBe(0);
  });

  it('shows the server message when the save is refused with a conflict', () => {
    customerService.getTaxEditability.mockReturnValue(of({ canEditTax: true, reason: null, activeDocumentId: 3, stateCode: 'UT', expiresAt: null }));
    soService['updateSalesOrder'].mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { title: 'Conflict', detail: 'A verified tax certificate is required to change the tax rate.' },
    })));
    const panel = build(order({ status: 'Confirmed' }));

    panel['startEditHeader']();
    panel['headerForm'].get('taxRate')!.setValue(0);
    panel['saveHeader']();

    expect(panel['headerError']()).toBe('A verified tax certificate is required to change the tax rate.');
    expect(panel['editingHeader']()).toBe(true);
  });
});
