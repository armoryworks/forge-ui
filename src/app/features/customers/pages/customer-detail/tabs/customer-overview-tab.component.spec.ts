import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CustomerOverviewTabComponent } from './customer-overview-tab.component';
import { CustomerService } from '../../../services/customer.service';
import { CustomerSummary } from '../../../models/customer-summary.model';
import { AuthService } from '../../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface TabApi {
  coaEnabled(): boolean;
  toggleFlag(key: string, next: boolean): void;
}

describe('CustomerOverviewTabComponent certificate of analysis flag', () => {
  let enabled: boolean;
  let updateCustomer: ReturnType<typeof vi.fn>;

  function create(): TabApi {
    updateCustomer = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      imports: [CustomerOverviewTabComponent],
      providers: [
        { provide: CustomerService, useValue: { updateCustomer } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-QC-COA' && enabled } },
      ],
    });
    TestBed.overrideComponent(CustomerOverviewTabComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(CustomerOverviewTabComponent);
    fixture.componentRef.setInput('customer', { id: 7, requiresCoa: false } as CustomerSummary);
    return fixture.componentInstance as unknown as TabApi;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    enabled = true;
  });

  it('saves the requires-certificate flag like the other compliance flags', () => {
    const tab = create();

    expect(tab.coaEnabled()).toBe(true);
    tab.toggleFlag('requiresCoa', true);

    expect(updateCustomer).toHaveBeenCalledWith(7, { requiresCoa: true });
  });

  it('hides the flag while certificates of analysis are off', () => {
    enabled = false;
    expect(create().coaEnabled()).toBe(false);
  });
});
