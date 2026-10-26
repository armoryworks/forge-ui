import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ShipmentService } from '../../services/shipment.service';
import { ShipmentDetail } from '../../models/shipment-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ShipmentPickupSectionComponent } from './shipment-pickup-section.component';

const SHIPMENT = {
  id: 7, shipmentNumber: 'SH-7', status: 'Pending', carrierIsApi: true, pickupConfirmationNumber: null,
} as unknown as ShipmentDetail;

interface Internals {
  canSchedule: Signal<boolean>;
  form: FormGroup;
  openSchedule(): void;
  schedule(): void;
  cancelPickup(): void;
}

describe('ShipmentPickupSectionComponent', () => {
  const schedulePickup = vi.fn(() => of({ confirmationNumber: 'PRP123', scheduledDate: '2026-11-02T16:30:00Z', carrierName: 'Parcel' }));
  const cancelPickup = vi.fn(() => of(undefined));
  const getPickupOrigin = vi.fn(() => of({ locationName: 'Main plant', timeZone: 'America/Denver' }));

  function create(shipment: ShipmentDetail = SHIPMENT): { c: Internals; changed: ReturnType<typeof vi.fn> } {
    const component = TestBed.runInInjectionContext(() => new ShipmentPickupSectionComponent());
    mockSignalInputs(component, { shipment });
    const changed = vi.fn();
    component.changed.subscribe(changed);
    return { c: component as unknown as Internals, changed };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    [schedulePickup, cancelPickup, getPickupOrigin].forEach(f => f.mockClear());
    TestBed.configureTestingModule({
      providers: [
        { provide: ShipmentService, useValue: { schedulePickup, cancelPickup, getPickupOrigin } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('sends the pickup window with the plant time-zone offset', () => {
    const { c, changed } = create();
    c.openSchedule();
    c.form.patchValue({ date: new Date(2026, 10, 2), readyTime: '09:30', closeTime: '16:00', instructions: ' Dock 3 ' });

    c.schedule();

    expect(schedulePickup).toHaveBeenCalledWith(7, {
      readyTime: '2026-11-02T09:30:00-07:00',
      closeTime: '2026-11-02T16:00:00-07:00',
      instructions: 'Dock 3',
    });
    expect(changed).toHaveBeenCalled();
  });

  it('refuses a window that closes before it opens', () => {
    const { c } = create();
    c.openSchedule();
    c.form.patchValue({ date: new Date(2026, 10, 2), readyTime: '15:00', closeTime: '09:00' });

    c.schedule();

    expect(c.form.hasError('pickupWindow')).toBe(true);
    expect(schedulePickup).not.toHaveBeenCalled();
  });

  it('offers scheduling only for an open shipment on an integrated carrier', () => {
    expect(create().c.canSchedule()).toBe(true);
    expect(create({ ...SHIPMENT, carrierIsApi: false }).c.canSchedule()).toBe(false);
    expect(create({ ...SHIPMENT, status: 'Shipped' }).c.canSchedule()).toBe(false);
    expect(create({ ...SHIPMENT, pickupConfirmationNumber: 'PRP1' }).c.canSchedule()).toBe(false);
  });

  it('cancels a scheduled pickup once confirmed', () => {
    const { c, changed } = create({ ...SHIPMENT, pickupConfirmationNumber: 'PRP1' });
    c.cancelPickup();
    expect(cancelPickup).toHaveBeenCalledWith(7);
    expect(changed).toHaveBeenCalled();
  });
});
