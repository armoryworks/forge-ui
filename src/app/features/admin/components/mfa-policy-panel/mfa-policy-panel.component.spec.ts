import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MfaPolicyPanelComponent } from './mfa-policy-panel.component';
import { MfaService } from '../../../account/services/mfa.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface PanelHarness {
  ngOnInit(): void;
  enforcedRolesControl: MfaPolicyPanelComponent['enforcedRolesControl'];
}

describe('MfaPolicyPanelComponent', () => {
  it('shows the stored policy roles, including one that no user holds yet', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MfaService,
          useValue: {
            getPolicy: vi.fn(() => of({ requiredRoles: ['Admin', 'Controller'] })),
            getCompliance: vi.fn(() => of([
              { userId: 1, fullName: 'A, B', email: 'a@b', role: 'Admin', mfaEnabled: true, mfaDeviceType: null, isEnforcedByPolicy: true },
            ])),
          },
        },
        { provide: ReferenceDataService, useValue: { getRolesAsOptions: vi.fn(() => of([])) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const panel = TestBed.runInInjectionContext(() => new MfaPolicyPanelComponent()) as unknown as PanelHarness;

    panel.ngOnInit();

    expect(panel.enforcedRolesControl.value).toEqual(['Admin', 'Controller']);
  });
});
