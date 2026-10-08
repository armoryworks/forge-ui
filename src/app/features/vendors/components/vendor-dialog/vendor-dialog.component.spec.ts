import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorService } from '../../services/vendor.service';
import { VendorDialogComponent } from './vendor-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function vendorDetail(overrides: Partial<VendorDetail> = {}): VendorDetail {
  return {
    id: 7,
    companyName: 'Acme Castings',
    vendorNumber: 'VEND-00007',
    contactName: 'Pat Doe',
    email: 'pat@example.com',
    phone: '555-0100',
    fax: '555-0101',
    address: '1 Main St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    country: 'US',
    paymentTerms: 'Net 30',
    notes: 'Ships Tuesdays',
    isActive: true,
    is1099: false,
    taxId: null,
    externalId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    purchaseOrders: [],
    offTierVariancePct: 7.5,
    ...overrides,
  };
}

describe('VendorDialogComponent', () => {
  const vendorService = {
    updateVendor: vi.fn(() => of(undefined)),
    createVendor: vi.fn(() => of({ id: 1 })),
  };

  function setup(vendor: VendorDetail | null): VendorDialogComponent {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: VendorService, useValue: vendorService },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new VendorDialogComponent());
    mockSignalInputs(component, { vendor });
    Object.defineProperty(component, 'dialogRef', { value: { clearDraft: vi.fn() } });
    return component;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('fills the edit form from the vendor input once it has arrived', () => {
    const component = setup(vendorDetail());

    component.ngOnInit();

    const value = component.form.getRawValue();
    expect(value.companyName).toBe('Acme Castings');
    expect(value.contactName).toBe('Pat Doe');
    expect(value.email).toBe('pat@example.com');
    expect(value.phone).toBe('555-0100');
    expect(value.fax).toBe('555-0101');
    expect(value.paymentTerms).toBe('Net 30');
    expect(value.notes).toBe('Ships Tuesdays');
    expect(value.offTierVariancePct).toBe(7.5);
    expect(value.address?.city).toBe('Springfield');
  });

  it('leaves the form blank for a new vendor', () => {
    const component = setup(null);

    component.ngOnInit();

    expect(component.form.getRawValue().companyName).toBe('');
    expect(component.form.getRawValue().fax).toBe('');
  });

  it('sends the fax number when saving an edited vendor', () => {
    const component = setup(vendorDetail());
    component.ngOnInit();
    component.form.controls.fax.setValue('555-0199');

    (component as unknown as { save(): void }).save();

    expect(vendorService.updateVendor).toHaveBeenCalledWith(7, expect.objectContaining({ fax: '555-0199' }));
  });

  it('sends the fax number when creating a vendor', () => {
    const component = setup(null);
    component.ngOnInit();
    component.form.patchValue({ companyName: 'New Co', fax: '555-0120' });

    (component as unknown as { save(): void }).save();

    expect(vendorService.createVendor).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: 'New Co', fax: '555-0120' }));
  });

  it('sends empty strings for an emptied email, phone and fax when saving an edited vendor', () => {
    const component = setup(vendorDetail());
    component.ngOnInit();
    component.form.patchValue({ email: '', phone: '', fax: '  ' });

    (component as unknown as { save(): void }).save();

    expect(vendorService.updateVendor).toHaveBeenCalledWith(7, expect.objectContaining({ email: '', phone: '', fax: '' }));
  });

  it('omits blank email, phone and fax when creating a vendor', () => {
    const component = setup(null);
    component.ngOnInit();
    component.form.patchValue({ companyName: 'New Co' });

    (component as unknown as { save(): void }).save();

    const body = (vendorService.createVendor.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(body['email']).toBeUndefined();
    expect(body['phone']).toBeUndefined();
    expect(body['fax']).toBeUndefined();
  });
});
