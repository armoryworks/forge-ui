import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CarrierService } from '../services/carrier.service';
import { Carrier } from '../models/carrier.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { CarriersComponent } from './carriers.component';

const UPS: Carrier = {
  id: 3, name: 'UPS', code: 'UPS', scac: null, integrationKind: 'Api', deliveryUpdateMode: 'Manual',
  integrationServiceId: 'ups', requiresScanToShip: true, isActive: true, sortOrder: 1,
  credentialsConfigured: false, credentialClientId: null, credentialEnvironment: null, notes: null,
};

interface CarriersInternals {
  carrierForm: FormGroup;
  openEdit(row: Carrier): void;
  openCreate(): void;
  saveCarrier(): void;
  showCarrierDialog(): boolean;
}

function setup() {
  const service = {
    list: vi.fn(() => of([UPS])),
    create: vi.fn(() => of(UPS)),
    update: vi.fn(() => of(UPS)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: CarrierService, useValue: service },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new CarriersComponent()) as unknown as CarriersInternals;
  return { component, service };
}

describe('CarriersComponent edit', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the carrier into the form and saves the edited settings with PUT', () => {
    const { component, service } = setup();

    component.openEdit(UPS);
    expect(component.carrierForm.getRawValue()).toMatchObject({ name: 'UPS', deliveryUpdateMode: 'Manual', requiresScanToShip: true });
    component.carrierForm.patchValue({ deliveryUpdateMode: 'Webhook', requiresScanToShip: false, isActive: false });
    component.saveCarrier();

    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).toHaveBeenCalledWith(3, expect.objectContaining({
      name: 'UPS', deliveryUpdateMode: 'Webhook', requiresScanToShip: false, isActive: false, integrationServiceId: 'ups',
    }));
    expect(component.showCarrierDialog()).toBe(false);
  });

  it('still creates a new carrier from the same dialog', () => {
    const { component, service } = setup();

    component.openCreate();
    component.carrierForm.patchValue({ name: 'House courier' });
    component.saveCarrier();

    expect(service.update).not.toHaveBeenCalled();
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'House courier' }));
  });
});
