import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MfaPolicyPanelComponent } from './mfa-policy-panel.component';
import { MfaService } from '../../../account/services/mfa.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface PanelHarness {
  ngOnInit(): void;
  savePolicy(): void;
  enforcedRolesControl: MfaPolicyPanelComponent['enforcedRolesControl'];
  graceDaysControl: MfaPolicyPanelComponent['graceDaysControl'];
}

function setup() {
  const mfaService = {
    getPolicy: vi.fn(() => of({ requiredRoles: ['Admin', 'Controller'], enrollmentGraceDays: 10 })),
    getCompliance: vi.fn(() => of([
      { userId: 1, fullName: 'A, B', email: 'a@b', role: 'Admin', mfaEnabled: true, mfaDeviceType: null, isEnforcedByPolicy: true },
    ])),
    setPolicy: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MfaService, useValue: mfaService },
      { provide: ReferenceDataService, useValue: { getRolesAsOptions: vi.fn(() => of([])) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const panel = TestBed.runInInjectionContext(() => new MfaPolicyPanelComponent()) as unknown as PanelHarness;
  panel.ngOnInit();
  return { panel, mfaService };
}

describe('MfaPolicyPanelComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the stored policy roles, including one that no user holds yet', () => {
    const { panel } = setup();

    expect(panel.enforcedRolesControl.value).toEqual(['Admin', 'Controller']);
  });

  it('shows the stored enrolment grace days and saves a change to them', () => {
    const { panel, mfaService } = setup();
    expect(panel.graceDaysControl.value).toBe(10);

    panel.graceDaysControl.setValue(0);
    panel.savePolicy();

    expect(mfaService.setPolicy).toHaveBeenCalledWith(['Admin', 'Controller'], 0);
  });

  it('does not save grace days outside 0 to 90', () => {
    const { panel, mfaService } = setup();

    panel.graceDaysControl.setValue(91);
    panel.savePolicy();

    expect(mfaService.setPolicy).not.toHaveBeenCalled();
  });
});
