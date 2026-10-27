import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SerialService } from '../../services/serial.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SerialNumber } from '../../models/serial-number.model';
import { SerialNumbersTabComponent } from './serial-numbers-tab.component';

interface TabInternals {
  createForm: FormGroup;
  lotsEnabled: () => boolean;
  lotFilters: () => Record<string, string>;
  openCreate: () => void;
  saveSerial: () => void;
  openDetail: (serial: SerialNumber) => void;
  canTransfer: () => boolean;
  openTransfer: () => void;
  transferForm: FormGroup;
  saveTransfer: () => void;
}

describe('SerialNumbersTabComponent', () => {
  const createSerialNumber = vi.fn((_partId: number, _body: Record<string, unknown>) => of({ id: 1 }));
  const transferSerial = vi.fn((_id: number, _body: Record<string, unknown>) => of(undefined));

  function setup(lotsOn = true, roles: string[] = ['Engineer']): TabInternals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: SerialService, useValue: { getPartSerials: vi.fn(() => of([])), createSerialNumber, transferSerial, getSerialHistory: vi.fn(() => of([])) } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-INV-LOTS' && lotsOn } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new SerialNumbersTabComponent());
    mockSignalInputs(component, { partId: 12 });
    return component as unknown as TabInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('registers the serial against the job and lot it was built from', () => {
    const tab = setup();
    tab.openCreate();
    tab.createForm.patchValue({ serialValue: 'SN-0002', jobId: 40, lotRecordId: 70 });

    tab.saveSerial();

    expect(createSerialNumber).toHaveBeenCalledWith(12, { serialValue: 'SN-0002', jobId: 40, lotRecordId: 70, notes: undefined });
  });

  it('leaves the job and lot off when none is picked', () => {
    const tab = setup();
    tab.openCreate();
    tab.createForm.patchValue({ serialValue: 'SN-0003' });

    tab.saveSerial();

    expect(createSerialNumber).toHaveBeenCalledWith(12, { serialValue: 'SN-0003', jobId: undefined, lotRecordId: undefined, notes: undefined });
  });

  it('offers the lot picker for this part while lot tracking is on', () => {
    const tab = setup();

    expect(tab.lotsEnabled()).toBe(true);
    expect(tab.lotFilters()).toEqual({ partId: '12' });
  });

  it('hides the lot picker while lot tracking is off', () => {
    expect(setup(false).lotsEnabled()).toBe(false);
  });

  function serial(overrides: Partial<SerialNumber> = {}): SerialNumber {
    return {
      id: 5, partId: 12, partNumber: 'P-12', serialValue: 'SN-0005', status: 'Available', jobId: null, jobNumber: null,
      lotRecordId: null, lotNumber: null, currentLocationId: 3, currentLocationName: 'Q1', shipmentLineId: null,
      customerId: null, customerName: null, parentSerialId: null, parentSerialValue: null, manufacturedAt: null,
      shippedAt: null, scrappedAt: null, notes: null, createdAt: '2026-10-01T00:00:00Z', childCount: 0,
      ...overrides,
    };
  }

  it('transfers a serial in stock to another location with the reason', () => {
    const tab = setup();
    tab.openDetail(serial());
    expect(tab.canTransfer()).toBe(true);
    tab.openTransfer();
    tab.transferForm.patchValue({ toLocationId: 9, reason: ' Rework cell ' });

    tab.saveTransfer();

    expect(transferSerial).toHaveBeenCalledWith(5, { toLocationId: 9, notes: 'Rework cell' });
  });

  it('offers no transfer for a shipped serial or to a production worker', () => {
    const tab = setup();
    tab.openDetail(serial({ status: 'Shipped' }));
    expect(tab.canTransfer()).toBe(false);

    TestBed.resetTestingModule();
    const worker = setup(true, ['ProductionWorker']);
    worker.openDetail(serial());
    expect(worker.canTransfer()).toBe(false);
  });
});
