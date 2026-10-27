import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ShipmentService } from '../../services/shipment.service';
import { ShipmentDetail } from '../../models/shipment-detail.model';
import { Address } from '../../../../shared/models/address.model';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EditShipmentDialogComponent } from './edit-shipment-dialog.component';

const SAVED: CustomerAddress = {
  id: 11, label: 'Warehouse', addressType: 'Shipping', line1: '12 main st', line2: null, city: 'springfield',
  state: 'IL', postalCode: '62701', country: 'US', isDefault: true,
};
const SHIPMENT = { id: 7, shipmentNumber: 'SH-7', status: 'Pending', shippingAddressId: 11, notes: null } as unknown as ShipmentDetail;
const CORRECTED: Address = { line1: '12 MAIN ST', line2: null, city: 'SPRINGFIELD', state: 'IL', postalCode: '62701-1234', country: 'US' };

interface Internals {
  form: FormGroup;
  shipToAddress: Signal<Address | null>;
  ngOnInit(): void;
  acceptValidatedAddress(address: Address): void;
}

describe('EditShipmentDialogComponent ship-to validation', () => {
  function create(): Internals {
    TestBed.configureTestingModule({
      providers: [
        { provide: ShipmentService, useValue: { getCustomerAddresses: vi.fn(() => of([SAVED])) } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new EditShipmentDialogComponent());
    mockSignalInputs(component, { shipment: SHIPMENT });
    const c = component as unknown as Internals;
    c.ngOnInit();
    return c;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('validates the saved ship-to that is picked', () => {
    const c = create();
    expect(c.shipToAddress()).toEqual(expect.objectContaining({ line1: '12 main st', postalCode: '62701' }));
  });

  it('accepting a suggestion for a saved address replaces the fields as a new address under the same label', () => {
    const c = create();

    c.acceptValidatedAddress(CORRECTED);

    expect(c.form.controls['shipTo'].value).toBe(-1);
    expect(c.form.controls['newLabel'].value).toBe('Warehouse');
    expect(c.form.controls['newType'].value).toBe('Shipping');
    expect(c.form.controls['newAddress'].value).toEqual(CORRECTED);
    expect(c.shipToAddress()).toEqual(CORRECTED);
  });

  it('accepting a suggestion while entering a new address replaces its fields', () => {
    const c = create();
    c.form.controls['shipTo'].setValue(-1);
    c.form.controls['newLabel'].setValue('Dock');
    c.form.controls['newAddress'].setValue({ ...CORRECTED, line1: '12 main' });

    c.acceptValidatedAddress(CORRECTED);

    expect(c.form.controls['newLabel'].value).toBe('Dock');
    expect(c.form.controls['newAddress'].value).toEqual(CORRECTED);
  });
});
