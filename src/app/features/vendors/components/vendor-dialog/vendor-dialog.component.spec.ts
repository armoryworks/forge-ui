import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
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
    paymentTermsId: 4,
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

  function setup(vendor: VendorDetail | null, autoPoOn = false): VendorDialogComponent {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: VendorService, useValue: vendorService },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => autoPoOn && code === 'CAP-P2P-AUTOPO' } },
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
    expect(value.paymentTermsId).toBe(4);
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

  describe('automatic purchasing', () => {
    type Api = { showAutoPoMode(): boolean; save(): void };

    it('shows the per-vendor mode on an edited vendor when auto-PO is on', () => {
      const component = setup(vendorDetail({ autoPoMode: 'Draft' }), true);
      component.ngOnInit();

      expect((component as unknown as Api).showAutoPoMode()).toBe(true);
      expect(component.form.controls.autoPoMode.value).toBe('Draft');
    });

    it('hides the mode when auto-PO is off or the vendor is new', () => {
      expect((setup(vendorDetail()) as unknown as Api).showAutoPoMode()).toBe(false);
      TestBed.resetTestingModule();
      expect((setup(null, true) as unknown as Api).showAutoPoMode()).toBe(false);
    });

    it('sends a chosen mode, and clears it when set back to the default', () => {
      const component = setup(vendorDetail({ autoPoMode: 'Draft' }), true);
      component.ngOnInit();
      component.form.controls.autoPoMode.setValue('Automatic');
      component.form.controls.autoPoMode.markAsDirty();

      (component as unknown as Api).save();
      expect(vendorService.updateVendor).toHaveBeenLastCalledWith(7, expect.objectContaining({ autoPoMode: 'Automatic' }));

      component.form.controls.autoPoMode.setValue('default');
      (component as unknown as Api).save();
      expect(vendorService.updateVendor).toHaveBeenLastCalledWith(7, expect.objectContaining({ clearAutoPoMode: true }));
    });

    it('leaves the mode out of the save when it was not touched', () => {
      const component = setup(vendorDetail({ autoPoMode: 'Suggest' }), true);
      component.ngOnInit();

      (component as unknown as Api).save();

      const payload = (vendorService.updateVendor.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('autoPoMode');
      expect(payload).not.toHaveProperty('clearAutoPoMode');
    });
  });
});
