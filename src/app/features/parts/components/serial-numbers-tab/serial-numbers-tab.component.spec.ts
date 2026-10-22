import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SerialService } from '../../services/serial.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SerialNumbersTabComponent } from './serial-numbers-tab.component';

interface TabInternals {
  createForm: FormGroup;
  lotsEnabled: () => boolean;
  lotFilters: () => Record<string, string>;
  openCreate: () => void;
  saveSerial: () => void;
}

describe('SerialNumbersTabComponent', () => {
  const createSerialNumber = vi.fn((_partId: number, _body: Record<string, unknown>) => of({ id: 1 }));

  function setup(lotsOn = true): TabInternals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: SerialService, useValue: { getPartSerials: vi.fn(() => of([])), createSerialNumber } },
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
});
