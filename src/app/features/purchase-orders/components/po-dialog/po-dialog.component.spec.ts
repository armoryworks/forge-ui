import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { NEVER, Observable, of } from 'rxjs';

import { PoDialogComponent } from './po-dialog.component';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PoVendorRefsService } from '../../services/po-vendor-refs.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { PartsService } from '../../../parts/services/parts.service';
import { VendorPartsService } from '../../../parts/services/vendor-parts.service';
import { PurchaseUnitsService } from '../../../parts/services/purchase-units.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { PoLineEntry } from '../../models/po-line-entry.model';
import { PoVendorRef } from '../../models/po-vendor-ref.model';
import { CreatePurchaseOrderRequest } from '../../models/create-purchase-order-request.model';
import { CheckTierVarianceResult } from '../../models/tier-variance-check.model';
import { VendorPart } from '../../../parts/models/vendor-part.model';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { OffTierPromptResult } from '../off-tier-prompt-dialog/off-tier-prompt-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  form: FormGroup;
  dialogRef: { clearDraft: () => void };
  lines: { set(lines: PoLineEntry[]): void };
  partOptions(): AutocompleteOption[];
  contactOptions(): SelectOption[];
  addressOptions(): SelectOption[];
  shipToOptions(): SelectOption[];
  makePartHint(): string | null;
  unapprovedSourceWarning(): string | null;
  lineSourceApproved(line: PoLineEntry): boolean | null;
  showOffTierPrompt(): boolean;
  offTierLines(): CheckTierVarianceResult[];
  noTierLines(): CheckTierVarianceResult[];
  onPartSearch(event: Event): void;
  save(): void;
  onOffTierConfirm(result: OffTierPromptResult): void;
}

function part(id: number, partNumber: string, procurementSource: string, name = partNumber): PartListItem {
  return {
    id, partNumber, name, description: null, status: 'Active', procurementSource,
    effectivePrice: 0, effectivePriceSource: 'Default',
  } as unknown as PartListItem;
}

function ref(id: number, label: string, isDefault = false): PoVendorRef {
  return { id, label, isDefault };
}

function partLine(partId: number, partNumber: string, overrides: Partial<PoLineEntry> = {}): PoLineEntry {
  return {
    partId, partNumber, description: partNumber, orderedQuantity: 10, unitPrice: 4,
    purchaseUnitId: null, purchaseUnitLabel: null, ...overrides,
  };
}

function tierResult(partId: number, overrides: Partial<CheckTierVarianceResult> = {}): CheckTierVarianceResult {
  return {
    partId, quantity: 10, unitPrice: 4, vendorPartId: null, tierPrice: null, currency: null,
    variancePct: null, isOffTier: false, hasTier: true, ...overrides,
  };
}

interface SetupOptions {
  parts?: PartListItem[];
  contacts?: PoVendorRef[] | null;
  addresses?: PoVendorRef[] | null;
  locations?: PoVendorRef[] | null;
  loadingVendorIds?: number[];
  vendorParts?: Partial<VendorPart>[];
  tierLines?: CheckTierVarianceResult[];
}

function setup(opts: SetupOptions = {}) {
  const createPurchaseOrder = vi.fn((_req: CreatePurchaseOrderRequest) => of({ id: 1 }));
  const checkTierVariance = vi.fn(() => of({ thresholdPct: 5, lines: opts.tierLines ?? [] }));
  const createVendorPart = vi.fn(() => of({ id: 77 }));
  const addPriceTier = vi.fn(() => of({ id: 1 }));
  const snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: PurchaseOrderService, useValue: { createPurchaseOrder } },
      { provide: VendorService, useValue: { getVendorDropdown: () => of([]) } },
      { provide: PartsService, useValue: { getParts: () => of(opts.parts ?? []) } },
      {
        provide: VendorPartsService,
        useValue: {
          listForPart: () => of([]),
          listForVendor: () => of(opts.vendorParts ?? []),
          checkTierVariance,
          create: createVendorPart,
          addPriceTier,
        },
      },
      { provide: PurchaseUnitsService, useValue: { list: () => of([]) } },
      { provide: ReferenceDataService, useValue: { getAsOptions: () => of([]) } },
      { provide: SnackbarService, useValue: snackbar },
      { provide: AuthService, useValue: { hasRole: () => true } },
      { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
      {
        provide: PoVendorRefsService,
        useValue: {
          getContacts: (vendorId: number) =>
            opts.loadingVendorIds?.includes(vendorId) ? NEVER : of(opts.contacts === undefined ? [] : opts.contacts),
          getOrderFromAddresses: (vendorId: number) =>
            opts.loadingVendorIds?.includes(vendorId) ? NEVER : of(opts.addresses === undefined ? [] : opts.addresses),
          getShipToLocations: () => of(opts.locations === undefined ? [] : opts.locations),
        },
      },
    ],
  });

  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', {
    poCreate: {
      makePartOnly: 'No buyable parts match. {{partNumber}} is made in-house.',
      noContact: 'No contact',
      noAddress: 'No address',
      noShipTo: 'No ship-to location',
      defaultContact: "Vendor's primary contact, if any",
      defaultAddress: "Vendor's default address, if any",
      defaultShipTo: 'Default company location, if any',
      unapprovedSourceWarning: 'Not approved: {{parts}}',
    },
  });
  translate.use('en');

  const component = TestBed.runInInjectionContext(() => new PoDialogComponent());
  const internals = component as unknown as DialogInternals;
  internals.dialogRef = { clearDraft: vi.fn() };
  return { internals, createPurchaseOrder, checkTierVariance, createVendorPart, addPriceTier, snackbar };
}

function searchFor(internals: DialogInternals, text: string): void {
  internals.onPartSearch({ target: { value: text } } as unknown as Event);
}

describe('PoDialogComponent — vendor contact, order-from address and ship-to', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('preselects the default ship-to location on open', () => {
    const { internals } = setup({ locations: [ref(1, 'Annex'), ref(2, 'Main plant', true)] });

    expect(internals.form.controls['shipToLocationId'].value).toBe(2);
  });

  it('preselects the primary contact and the default order-from address once a vendor is chosen', () => {
    const { internals } = setup({
      contacts: [ref(10, 'Sam Buyer'), ref(11, 'Pat Primary', true)],
      addresses: [ref(20, 'Order desk', true), ref(21, 'Remit')],
    });

    internals.form.controls['vendorId'].setValue(5);

    expect(internals.form.controls['vendorContactId'].value).toBe(11);
    expect(internals.form.controls['vendorAddressId'].value).toBe(20);
    expect(internals.contactOptions().map(o => o.label)).toEqual(['Sam Buyer', 'Pat Primary']);
    expect(internals.addressOptions().map(o => o.label)).toEqual(['Order desk', 'Remit']);
  });

  it('keeps a restored contact that belongs to the vendor instead of the default', () => {
    const { internals } = setup({ contacts: [ref(10, 'Sam Buyer'), ref(11, 'Pat Primary', true)] });

    internals.form.patchValue({ vendorId: 5, vendorContactId: 10 });

    expect(internals.form.controls['vendorContactId'].value).toBe(10);
  });

  it('offers no contact only when the vendor has no primary contact', () => {
    const { internals } = setup({ contacts: [ref(10, 'Sam'), ref(12, 'Lee')] });

    internals.form.controls['vendorId'].setValue(5);

    expect(internals.form.controls['vendorContactId'].value).toBeNull();
    expect(internals.contactOptions().map(o => o.label)).toEqual(['No contact', 'Sam', 'Lee']);
  });

  it('labels the empty choice as the server default when the lists cannot be read', () => {
    const { internals } = setup({ contacts: null, addresses: null, locations: null });

    internals.form.controls['vendorId'].setValue(5);

    expect(internals.contactOptions()).toEqual([{ value: null, label: "Vendor's primary contact, if any" }]);
    expect(internals.addressOptions()).toEqual([{ value: null, label: "Vendor's default address, if any" }]);
    expect(internals.shipToOptions()).toEqual([{ value: null, label: 'Default company location, if any' }]);
    expect(internals.form.controls['shipToLocationId'].value).toBeNull();
  });

  it('says there is no ship-to location only when the company has none', () => {
    const { internals } = setup({ locations: [] });

    expect(internals.shipToOptions()).toEqual([{ value: null, label: 'No ship-to location' }]);
  });

  it('drops the previous vendor\'s contact and address as soon as the vendor changes', () => {
    const { internals } = setup({
      contacts: [ref(11, 'Pat', true)],
      addresses: [ref(20, 'Order desk', true)],
      loadingVendorIds: [6],
    });
    internals.form.controls['vendorId'].setValue(5);
    expect(internals.form.controls['vendorContactId'].value).toBe(11);

    internals.form.controls['vendorId'].setValue(6);

    expect(internals.form.controls['vendorContactId'].value).toBeNull();
    expect(internals.form.controls['vendorAddressId'].value).toBeNull();
    expect(internals.contactOptions()).toEqual([{ value: null, label: "Vendor's primary contact, if any" }]);
  });

  it('sends the chosen contact, address and ship-to ids on create', () => {
    const { internals, createPurchaseOrder } = setup({
      contacts: [ref(11, 'Pat', true)],
      addresses: [ref(20, 'Order desk', true)],
      locations: [ref(2, 'Main plant', true)],
    });
    internals.form.controls['vendorId'].setValue(5);
    internals.lines.set([{ ...partLine(1, 'P-1'), partId: null, partNumber: null }]);

    internals.save();

    expect(createPurchaseOrder).toHaveBeenCalledOnce();
    const req = createPurchaseOrder.mock.calls[0][0];
    expect(req.vendorContactId).toBe(11);
    expect(req.vendorAddressId).toBe(20);
    expect(req.shipToLocationId).toBe(2);
  });
});

describe('PoDialogComponent — part picker', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists only buy and subcontract parts, sorted by part number', () => {
    const { internals } = setup({
      parts: [
        part(1, 'P-10', 'Buy'),
        part(2, 'M-1', 'Make'),
        part(3, 'P-2', 'Subcontract'),
        part(4, 'A-5', 'Buy'),
        part(5, 'X-1', 'Phantom'),
      ],
    });

    expect(internals.partOptions().map(o => o['value'])).toEqual([4, 3, 1]);
  });

  it('explains that a typed make part is made in-house when nothing buyable matches', () => {
    const { internals } = setup({ parts: [part(1, 'P-10', 'Buy'), part(2, 'ASM-200', 'Make')] });

    searchFor(internals, 'asm-200');

    expect(internals.makePartHint()).toBe('No buyable parts match. ASM-200 is made in-house.');
  });

  it('shows no explanation while a buyable part still matches the text', () => {
    const { internals } = setup({ parts: [part(1, 'ASM-200-B', 'Buy'), part(2, 'ASM-200', 'Make')] });

    searchFor(internals, 'ASM-200');

    expect(internals.makePartHint()).toBeNull();
  });

  it('shows no explanation when the text matches a hidden obsolete buy part', () => {
    const obsolete = { ...part(1, 'ASM-200-B', 'Buy'), status: 'Obsolete' } as PartListItem;
    const { internals } = setup({ parts: [obsolete, part(2, 'ASM-200', 'Make')] });

    searchFor(internals, 'ASM-200');

    expect(internals.partOptions()).toEqual([]);
    expect(internals.makePartHint()).toBeNull();
  });

  it('shows no explanation when the text matches no part at all', () => {
    const { internals } = setup({ parts: [part(2, 'ASM-200', 'Make')] });

    searchFor(internals, 'ZZZ');

    expect(internals.makePartHint()).toBeNull();
  });
});

describe('PoDialogComponent — approved sources', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('marks each line approved or not from the vendor part and warns without blocking', () => {
    const { internals } = setup({
      vendorParts: [{ partId: 1, isApproved: true }, { partId: 2, isApproved: false }],
    });
    internals.form.controls['vendorId'].setValue(5);
    const approved = partLine(1, 'P-1');
    const unapproved = partLine(2, 'P-2');
    const unlisted = partLine(3, 'P-3');
    internals.lines.set([approved, unapproved, unlisted]);

    expect(internals.lineSourceApproved(approved)).toBe(true);
    expect(internals.lineSourceApproved(unapproved)).toBe(false);
    expect(internals.lineSourceApproved(unlisted)).toBe(false);
    expect(internals.unapprovedSourceWarning()).toBe('Not approved: P-2, P-3');
  });

  it('shows no badge before a vendor is chosen or for a non-stock line', () => {
    const { internals } = setup();

    expect(internals.lineSourceApproved(partLine(1, 'P-1'))).toBeNull();
    internals.form.controls['vendorId'].setValue(5);
    expect(internals.lineSourceApproved({ ...partLine(1, 'P-1'), partId: null })).toBeNull();
    expect(internals.unapprovedSourceWarning()).toBeNull();
  });
});

describe('PoDialogComponent — off-tier prompt', () => {
  beforeEach(() => TestBed.resetTestingModule());

  function readyToSave(tierLines: CheckTierVarianceResult[]) {
    const ctx = setup({ tierLines });
    ctx.internals.form.controls['vendorId'].setValue(5);
    ctx.internals.lines.set([partLine(1, 'P-1'), partLine(2, 'P-2', { purchaseUnitId: 9 })]);
    return ctx;
  }

  it('creates the PO without a prompt when the only flagged lines have no tier', () => {
    const { internals, createPurchaseOrder } = readyToSave([
      tierResult(1, { hasTier: false }),
      tierResult(2, { hasTier: false, isOffTier: true }),
    ]);

    internals.save();

    expect(internals.showOffTierPrompt()).toBe(false);
    expect(createPurchaseOrder).toHaveBeenCalledOnce();
  });

  it('prompts for real off-tier lines and offers to save a price for the no-tier lines', () => {
    const { internals, createPurchaseOrder } = readyToSave([
      tierResult(1, { isOffTier: true, tierPrice: 3, variancePct: 33, vendorPartId: 40 }),
      tierResult(2, { hasTier: false }),
    ]);

    internals.save();

    expect(internals.showOffTierPrompt()).toBe(true);
    expect(internals.offTierLines().map(l => l.partId)).toEqual([1]);
    expect(internals.noTierLines().map(l => l.partId)).toEqual([2]);
    expect(createPurchaseOrder).not.toHaveBeenCalled();
  });

  it('offers to save a price once per part even when the part is on two lines', () => {
    const { internals } = readyToSave([
      tierResult(1, { isOffTier: true, tierPrice: 3, variancePct: 33, vendorPartId: 40 }),
      tierResult(2, { hasTier: false }),
      tierResult(2, { hasTier: false, quantity: 5 }),
    ]);

    internals.save();

    expect(internals.noTierLines().map(l => l.quantity)).toEqual([10]);
  });

  it('creates the vendor part when needed and saves the entered price as its first tier', () => {
    const { internals, createVendorPart, addPriceTier, createPurchaseOrder } = readyToSave([]);

    internals.onOffTierConfirm({ updateTierLines: [], savePriceLines: [tierResult(2, { hasTier: false })] });

    expect(createVendorPart).toHaveBeenCalledWith(expect.objectContaining({ vendorId: 5, partId: 2, isApproved: false }));
    expect(addPriceTier).toHaveBeenCalledWith(77, expect.objectContaining({ minQuantity: 1, unitPrice: 4, purchaseUnitId: 9 }));
    expect(createPurchaseOrder).toHaveBeenCalledOnce();
  });

  it('adds the price to an existing vendor part without creating another', () => {
    const { internals, createVendorPart, addPriceTier } = readyToSave([]);

    internals.onOffTierConfirm({ updateTierLines: [], savePriceLines: [tierResult(1, { hasTier: false, vendorPartId: 40 })] });

    expect(createVendorPart).not.toHaveBeenCalled();
    expect(addPriceTier).toHaveBeenCalledWith(40, expect.objectContaining({ unitPrice: 4, purchaseUnitId: null }));
  });
});
