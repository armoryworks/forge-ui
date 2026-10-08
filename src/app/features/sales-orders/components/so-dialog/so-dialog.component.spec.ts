import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { CreditStatus } from '../../../customers/models/credit-status.model';
import { CustomerTaxEditability } from '../../../customers/models/customer-tax-editability.model';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { SoDialogComponent } from './so-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  lineForm: FormGroup<{
    partId: FormControl<number | null>;
    quantity: FormControl<number | null>;
    unitPrice: FormControl<number | null>;
  }>;
  lines(): { partId: number; unitPrice: number }[];
  priceIsListPrice(): boolean;
  creditHoldMessage(): string | null;
  taxLocked(): boolean;
  draftConfig: { snapshotFn(): Record<string, unknown>; restoreFn(data: Record<string, unknown>): void };
  onCustomerSelected(customer: Record<string, unknown> | null): void;
  shipToOptions(): { value: unknown }[];
  billToOptions(): { value: unknown }[];
  addLine(): void;
  save(): void;
  dialogRef: { clearDraft(): void };
}

const api = environment.apiUrl;

function part(overrides: Partial<PartListItem> = {}): PartListItem {
  return {
    id: 20,
    partNumber: 'P-20',
    name: 'Bracket',
    description: null,
    revision: 'A',
    status: 'Active',
    procurementSource: 'Make',
    inventoryClass: 'Component',
    bomLineCount: 0,
    createdAt: new Date(),
    effectivePrice: 0,
    effectivePriceCurrency: 'USD',
    effectivePriceSource: 'Default',
    ...overrides,
  } as PartListItem;
}

function address(id: number, addressType: string, isDefault: boolean, isActive = true): CustomerAddress {
  return {
    id, label: `Address ${id}`, addressType, line1: '1 Main St', city: 'Denver',
    state: 'CO', postalCode: '80202', country: 'US', isDefault, isActive,
  };
}

function creditStatus(overrides: Partial<CreditStatus> = {}): CreditStatus {
  return {
    customerId: 5, customerName: 'Customer', creditLimit: null, openArBalance: 0,
    pendingOrdersTotal: 0, totalExposure: 0, availableCredit: 0, utilizationPercent: 0,
    isOnHold: false, holdReason: null, isOverLimit: false, riskLevel: 'Low',
    unappliedCreditAmount: 0, unappliedCredits: [],
    ...overrides,
  };
}

function setup(parts: PartListItem[] = [part()], confirmed = true) {
  TestBed.resetTestingModule();
  const dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirmed) }));
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialog, useValue: { open: dialogOpen } },
    ],
  });

  const component = TestBed.runInInjectionContext(() => new SoDialogComponent());
  const httpMock = TestBed.inject(HttpTestingController);

  httpMock.expectOne(r => r.url === `${api}/parts`).flush({ items: parts, totalCount: parts.length, page: 1, pageSize: 200 });

  return { component, internals: component as unknown as DialogInternals, httpMock, dialogOpen };
}

function editability(canEditTax: boolean): CustomerTaxEditability {
  return { canEditTax, reason: null, activeDocumentId: null, stateCode: 'CO', expiresAt: null };
}

function flushTax(
  httpMock: HttpTestingController,
  customerId: number,
  rate: number | null = null,
  canEditTax = true,
): void {
  httpMock.expectOne(`${api}/sales-tax-rates/for-customer/${customerId}`)
    .flush(rate == null ? null : { id: 1, name: 'State', code: 'CO', stateCode: 'CO', rate });
  httpMock.expectOne(`${api}/customers/${customerId}/tax-editability`).flush(editability(canEditTax));
}

function selectCustomer(
  component: SoDialogComponent,
  httpMock: HttpTestingController,
  addresses: CustomerAddress[] = [],
  status: CreditStatus = creditStatus(),
  customerId = 5,
): void {
  component.form.controls.customerId.setValue(customerId);
  httpMock.expectOne(r => r.url === `${api}/customers/${customerId}/addresses`).flush(addresses);
  httpMock.expectOne(`${api}/customers/${customerId}/credit-status`).flush(status);
  flushTax(httpMock, customerId);
}

function expectPriceLookup(httpMock: HttpTestingController, customerId: number, partId: number, price: number | null): void {
  httpMock.expectOne(r =>
    r.url === `${api}/quotes/resolve-price`
    && r.params.get('customerId') === String(customerId)
    && r.params.get('partId') === String(partId)).flush(price);
}

describe('SoDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('ship-to and bill-to', () => {
    it('prefills the default address of each type when a customer is picked', () => {
      const { component, internals, httpMock } = setup();

      selectCustomer(component, httpMock, [
        address(1, 'Shipping', false),
        address(2, 'Shipping', true),
        address(3, 'Billing', true),
      ]);

      expect(component.form.controls.shippingAddressId.value).toBe(2);
      expect(component.form.controls.billingAddressId.value).toBe(3);
      expect(internals.shipToOptions().map(o => o.value)).toEqual([null, 1, 2]);
      expect(internals.billToOptions().map(o => o.value)).toEqual([null, 3]);
      httpMock.verify();
    });

    it('lists a Both address for either and uses a Both default for both', () => {
      const { component, internals, httpMock } = setup();

      selectCustomer(component, httpMock, [address(4, 'Both', true), address(5, 'Shipping', false, false)]);

      expect(component.form.controls.shippingAddressId.value).toBe(4);
      expect(component.form.controls.billingAddressId.value).toBe(4);
      expect(internals.shipToOptions().map(o => o.value)).toEqual([null, 4]);
      expect(internals.billToOptions().map(o => o.value)).toEqual([null, 4]);
      httpMock.verify();
    });

    it('clears the addresses when the customer changes', () => {
      const { component, httpMock } = setup();
      selectCustomer(component, httpMock, [address(2, 'Shipping', true)]);

      selectCustomer(component, httpMock, [], creditStatus({ customerId: 6 }), 6);

      expect(component.form.controls.shippingAddressId.value).toBeNull();
      expect(component.form.controls.billingAddressId.value).toBeNull();
      httpMock.verify();
    });

    it('sends the chosen ship-to and bill-to on save', () => {
      const { component, internals, httpMock } = setup([part({ id: 20 })]);
      internals.dialogRef = { clearDraft: vi.fn() };
      selectCustomer(component, httpMock, [address(2, 'Shipping', true), address(3, 'Billing', true)]);
      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, 12.5);
      internals.addLine();

      component.form.controls.billingAddressId.setValue(null);
      internals.save();

      const req = httpMock.expectOne(r => r.method === 'POST' && r.url === `${api}/orders`);
      expect(req.request.body.shippingAddressId).toBe(2);
      expect(req.request.body.billingAddressId).toBeUndefined();
      req.flush({});
      httpMock.verify();
    });
  });

  describe('price prefill', () => {
    it('prefills the customer price and shows the list-price indicator until edited', () => {
      const { component, internals, httpMock } = setup();
      selectCustomer(component, httpMock);

      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, 42);

      expect(internals.lineForm.controls.unitPrice.value).toBe(42);
      expect(internals.priceIsListPrice()).toBe(true);

      internals.lineForm.controls.unitPrice.setValue(40);
      expect(internals.priceIsListPrice()).toBe(false);
      httpMock.verify();
    });

    it('falls back to the part effective price when the customer has no price', () => {
      const { component, internals, httpMock } = setup([part({ effectivePrice: 9.5, effectivePriceSource: 'PartPrice' })]);
      selectCustomer(component, httpMock);

      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, null);

      expect(internals.lineForm.controls.unitPrice.value).toBe(9.5);
      expect(internals.priceIsListPrice()).toBe(true);
      httpMock.verify();
    });

    it('ignores a Default-source effective price', () => {
      const { component, internals, httpMock } = setup([part({ effectivePrice: 3, effectivePriceSource: 'Default' })]);
      selectCustomer(component, httpMock);

      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, null);

      expect(internals.lineForm.controls.unitPrice.value).toBe(0);
      expect(internals.priceIsListPrice()).toBe(false);
      httpMock.verify();
    });

    it('uses the part effective price without a lookup when no customer is chosen', () => {
      const { internals, httpMock } = setup([part({ effectivePrice: 7, effectivePriceSource: 'PriceListEntry' })]);

      internals.lineForm.controls.partId.setValue(20);

      expect(internals.lineForm.controls.unitPrice.value).toBe(7);
      httpMock.verify();
    });

    it('re-resolves only the pending line when the customer changes', () => {
      const { component, internals, httpMock } = setup([part({ id: 20 }), part({ id: 21, partNumber: 'P-21' })]);
      selectCustomer(component, httpMock);
      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, 10);
      internals.addLine();
      internals.lineForm.controls.partId.setValue(21);
      expectPriceLookup(httpMock, 5, 21, 11);

      component.form.controls.customerId.setValue(6);
      httpMock.expectOne(r => r.url === `${api}/customers/6/addresses`).flush([]);
      httpMock.expectOne(`${api}/customers/6/credit-status`).flush(creditStatus({ customerId: 6 }));
      flushTax(httpMock, 6);
      expectPriceLookup(httpMock, 6, 21, 15);

      expect(internals.lineForm.controls.unitPrice.value).toBe(15);
      expect(internals.lines().map(l => l.unitPrice)).toEqual([10]);
      httpMock.verify();
    });

    it('resets the price to 0 when the next part has no price', () => {
      const { component, internals, httpMock } = setup([part({ id: 20 }), part({ id: 21, partNumber: 'P-21' })]);
      selectCustomer(component, httpMock);
      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, 25);

      internals.lineForm.controls.partId.setValue(21);
      expectPriceLookup(httpMock, 5, 21, null);

      expect(internals.lineForm.controls.unitPrice.value).toBe(0);
      expect(internals.priceIsListPrice()).toBe(false);
      httpMock.verify();
    });

    it('resets the price to 0 when the new customer has no price', () => {
      const { component, internals, httpMock } = setup();
      selectCustomer(component, httpMock);
      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, 25);

      component.form.controls.customerId.setValue(6);
      httpMock.expectOne(r => r.url === `${api}/customers/6/addresses`).flush([]);
      httpMock.expectOne(`${api}/customers/6/credit-status`).flush(creditStatus({ customerId: 6 }));
      flushTax(httpMock, 6);
      expectPriceLookup(httpMock, 6, 20, null);

      expect(internals.lineForm.controls.unitPrice.value).toBe(0);
      expect(internals.priceIsListPrice()).toBe(false);
      httpMock.verify();
    });

    it('does not overwrite a price typed while the lookup was in flight', () => {
      const { component, internals, httpMock } = setup();
      selectCustomer(component, httpMock);
      internals.lineForm.controls.partId.setValue(20);
      internals.lineForm.controls.unitPrice.setValue(8);
      internals.lineForm.controls.unitPrice.markAsDirty();

      expectPriceLookup(httpMock, 5, 20, 25);

      expect(internals.lineForm.controls.unitPrice.value).toBe(8);
      expect(internals.priceIsListPrice()).toBe(false);
      httpMock.verify();
    });

    it('keeps a price the user typed when the customer changes', () => {
      const { component, internals, httpMock } = setup();
      selectCustomer(component, httpMock);
      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, 10);
      internals.lineForm.controls.unitPrice.setValue(8);
      internals.lineForm.controls.unitPrice.markAsDirty();

      selectCustomer(component, httpMock, [], creditStatus({ customerId: 6 }), 6);

      expect(internals.lineForm.controls.unitPrice.value).toBe(8);
      httpMock.verify();
    });
  });

  describe('zero-price confirmation', () => {
    it('asks before adding a $0 line and skips it when declined', () => {
      const { internals, httpMock, dialogOpen } = setup([part()], false);
      internals.lineForm.controls.partId.setValue(20);

      internals.addLine();

      expect(dialogOpen).toHaveBeenCalledTimes(1);
      expect(internals.lines()).toHaveLength(0);
      httpMock.verify();
    });

    it('adds the $0 line when confirmed', () => {
      const { internals, httpMock, dialogOpen } = setup([part()], true);
      internals.lineForm.controls.partId.setValue(20);

      internals.addLine();

      expect(dialogOpen).toHaveBeenCalledTimes(1);
      expect(internals.lines()).toEqual([expect.objectContaining({ partId: 20, unitPrice: 0 })]);
      httpMock.verify();
    });

    it('does not ask for a priced line', () => {
      const { internals, httpMock, dialogOpen } = setup();
      internals.lineForm.controls.partId.setValue(20);
      internals.lineForm.controls.unitPrice.setValue(5);

      internals.addLine();

      expect(dialogOpen).not.toHaveBeenCalled();
      expect(internals.lines()).toHaveLength(1);
      httpMock.verify();
    });
  });

  describe('credit hold', () => {
    it('shows the warning when the customer is on hold and still allows saving', () => {
      const { component, internals, httpMock } = setup();

      selectCustomer(component, httpMock, [], creditStatus({ isOnHold: true, holdReason: 'Past due' }));

      expect(internals.creditHoldMessage()).not.toBeNull();
      expect(component.form.valid).toBe(true);
      httpMock.verify();
    });

    it('names the hold reason, or says it was not specified', () => {
      const { component, internals, httpMock } = setup();
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', {
        salesOrders: { creditHoldWarning: 'On hold ({{reason}})' },
        onboarding: { notSpecified: 'Not specified' },
      });
      translate.use('en');

      selectCustomer(component, httpMock, [], creditStatus({ isOnHold: true, holdReason: 'Past due' }));
      expect(internals.creditHoldMessage()).toBe('On hold (Past due)');

      selectCustomer(component, httpMock, [], creditStatus({ customerId: 6, isOnHold: true, holdReason: ' ' }), 6);
      expect(internals.creditHoldMessage()).toBe('On hold (Not specified)');
      httpMock.verify();
    });

    it('shows no warning when the customer is not on hold', () => {
      const { component, internals, httpMock } = setup();

      selectCustomer(component, httpMock);

      expect(internals.creditHoldMessage()).toBeNull();
      httpMock.verify();
    });
  });

  describe('tax rate', () => {
    function pickCustomer(component: SoDialogComponent, httpMock: HttpTestingController, rate: number | null, canEditTax: boolean, customerId = 5): void {
      component.form.controls.customerId.setValue(customerId);
      httpMock.expectOne(r => r.url === `${api}/customers/${customerId}/addresses`).flush([]);
      httpMock.expectOne(`${api}/customers/${customerId}/credit-status`).flush(creditStatus({ customerId }));
      flushTax(httpMock, customerId, rate, canEditTax);
    }

    it('fills the customer rate and locks it without a verified certificate', () => {
      const { component, internals, httpMock } = setup();

      pickCustomer(component, httpMock, 0.0725, false);

      expect(component.form.controls.taxRate.value).toBe(7.25);
      expect(component.form.controls.taxRate.disabled).toBe(true);
      expect(internals.taxLocked()).toBe(true);
      httpMock.verify();
    });

    it('fills the rate but leaves it editable with a verified certificate', () => {
      const { component, internals, httpMock } = setup();

      pickCustomer(component, httpMock, 0.05, true);

      expect(component.form.controls.taxRate.value).toBe(5);
      expect(component.form.controls.taxRate.enabled).toBe(true);
      expect(internals.taxLocked()).toBe(false);
      httpMock.verify();
    });

    it('unlocks and refills when the customer changes', () => {
      const { component, internals, httpMock } = setup();
      pickCustomer(component, httpMock, 0.0725, false);

      pickCustomer(component, httpMock, null, true, 6);

      expect(component.form.controls.taxRate.value).toBe(0);
      expect(component.form.controls.taxRate.enabled).toBe(true);
      expect(internals.taxLocked()).toBe(false);
      httpMock.verify();
    });

    it('sends the locked rate on save', () => {
      const { component, internals, httpMock } = setup([part({ id: 20 })]);
      internals.dialogRef = { clearDraft: vi.fn() };
      pickCustomer(component, httpMock, 0.0725, false);
      internals.lineForm.controls.partId.setValue(20);
      expectPriceLookup(httpMock, 5, 20, 10);
      internals.addLine();

      internals.save();

      const req = httpMock.expectOne(r => r.method === 'POST' && r.url === `${api}/orders`);
      expect(req.request.body.taxRate).toBeCloseTo(0.0725, 6);
      req.flush({});
      httpMock.verify();
    });
  });

  describe('draft', () => {
    it('keeps the requested delivery day and the customer name through a draft', () => {
      const { component, internals, httpMock } = setup();
      internals.onCustomerSelected({ id: 5, name: 'Customer Five' });
      component.form.controls.requestedDeliveryDate.setValue(new Date(2026, 9, 30));

      const snapshot = JSON.parse(JSON.stringify(internals.draftConfig.snapshotFn())) as Record<string, unknown>;
      expect(snapshot['requestedDeliveryDate']).toBe('2026-10-30T00:00:00Z');
      expect(snapshot['customerName']).toBe('Customer Five');

      component.form.controls.requestedDeliveryDate.setValue(null);
      internals.draftConfig.restoreFn(snapshot);

      const restored = component.form.controls.requestedDeliveryDate.value;
      expect([restored?.getFullYear(), restored?.getMonth(), restored?.getDate()]).toEqual([2026, 9, 30]);
      httpMock.verify();
    });
  });
});
