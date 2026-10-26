import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VendorReturnDetailPanelComponent } from './vendor-return-detail-panel.component';
import { VendorReturnService } from '../../services/vendor-return.service';
import { VendorReturnDetail } from '../../models/vendor-return-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface PanelInternals {
  rtv: { set(value: VendorReturnDetail | null): void; (): VendorReturnDetail | null };
  canShip(): boolean;
  canCredit(): boolean;
  openShip(): void;
  shipForm: { patchValue(v: Record<string, unknown>): void };
  ship(): void;
  openCredit(): void;
  creditForm: { controls: { prices: { at(i: number): { setValue(v: number): void } } } };
  recordCredit(): void;
}

const rtv = (status: string): VendorReturnDetail => ({
  id: 3, returnNumber: 'RTV-000003', vendorId: 2, vendorName: 'Resin Co', nonConformanceId: 9, ncrNumber: 'NCR-9',
  purchaseOrderId: null, purchaseOrderNumber: null, status, expectedCredit: 200, currencyId: 1, currencyCode: 'USD', fxRate: 1,
  shipDate: null, carrier: null, trackingNumber: null, rmaNumber: null, notes: null,
  lines: [{ id: 11, lineNumber: 1, partId: 5, partNumber: 'RES-1', partDescription: 'Resin', lotNumber: 'L-1', locationId: 1,
    locationName: 'QC cage', quantity: 20, unitPrice: 10, unitCost: 10, shippedCost: null }],
  vendorCreditMemoId: null, vendorCreditMemoNumber: null, createdAt: '', rowVersion: 1,
});

describe('VendorReturnDetailPanelComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;

  const build = (roles: string[]): PanelInternals => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorReturnService, useValue: service },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new VendorReturnDetailPanelComponent()) as unknown as PanelInternals;
  };

  beforeEach(() => {
    service = {
      getById: vi.fn(() => of(rtv('Credited'))),
      ship: vi.fn(() => of(rtv('Shipped'))),
      recordCredit: vi.fn(() => of({ id: 8, memoNumber: 'VCM-000008' })),
    };
  });

  it('lets Procurement ship an open return with the carrier and tracking number', () => {
    const panel = build(['Procurement']);
    panel.rtv.set(rtv('Open'));
    expect(panel.canShip()).toBe(true);
    expect(panel.canCredit()).toBe(false);

    panel.openShip();
    panel.shipForm.patchValue({ carrier: 'UPS', trackingNumber: '1Z9' });
    panel.ship();

    expect(service['ship']).toHaveBeenCalledWith(3, expect.objectContaining({ carrier: 'UPS', trackingNumber: '1Z9' }));
    expect(panel.rtv()?.status).toBe('Shipped');
    expect(panel.canCredit()).toBe(true);
  });

  it('records the vendor credit at the price the vendor credited', () => {
    const panel = build(['OfficeManager']);
    panel.rtv.set(rtv('Shipped'));

    panel.openCredit();
    panel.creditForm.controls.prices.at(0).setValue(9);
    panel.recordCredit();

    expect(service['recordCredit']).toHaveBeenCalledWith(3, expect.objectContaining({
      lines: [{ vendorReturnLineId: 11, quantity: null, unitPrice: 9 }],
    }));
  });

  it('shows no ship or credit action to roles outside receiving', () => {
    const panel = build(['Controller', 'Engineer']);
    panel.rtv.set(rtv('Open'));
    expect(panel.canShip()).toBe(false);
    panel.rtv.set(rtv('Shipped'));
    expect(panel.canCredit()).toBe(false);
  });
});
