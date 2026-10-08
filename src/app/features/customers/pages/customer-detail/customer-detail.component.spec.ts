import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerSummary } from '../../models/customer-summary.model';
import { CustomerDetailLayoutResolverService } from '../../services/customer-detail-layout-resolver.service';
import { CustomerService } from '../../services/customer.service';
import { CustomerDetailComponent } from './customer-detail.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const CUSTOMER: CustomerSummary = {
  id: 5,
  name: 'Acme Co',
  companyName: 'Acme Corp',
  email: 'sales@acme.test',
  phone: '(555) 555-1212',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  estimateCount: 0,
  quoteCount: 0,
  orderCount: 0,
  activeJobCount: 0,
  openInvoiceCount: 0,
  openInvoiceTotal: 0,
  ytdRevenue: 0,
};

describe('CustomerDetailComponent · saveClusterPatch', () => {
  const customerService = {
    getCustomerSummary: vi.fn(() => of(CUSTOMER)),
    updateCustomer: vi.fn(() => of(undefined)),
  };

  function setup(): CustomerDetailComponent {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '5', tab: 'overview' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CustomerService, useValue: customerService },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: CustomerDetailLayoutResolverService, useValue: { deriveLifecycle: () => 'active', resolve: () => [] } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CustomerDetailComponent());
    TestBed.flushEffects();
    return component;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('passes emptied company name, email and phone through to the update as empty strings', () => {
    const component = setup();

    (component as unknown as { saveClusterPatch(p: Partial<CustomerSummary>): void })
      .saveClusterPatch({ name: 'Acme Co', companyName: '', email: '', phone: '', isActive: true });

    expect(customerService.updateCustomer).toHaveBeenCalledWith(5, expect.objectContaining({
      companyName: '',
      email: '',
      phone: '',
    }));
  });
});
