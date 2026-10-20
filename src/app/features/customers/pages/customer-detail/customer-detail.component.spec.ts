import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader, TranslatePipe } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { NavTreeService } from '../../../../shared/services/nav-tree.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerSummary } from '../../models/customer-summary.model';
import { UpdateCustomerRequest } from '../../models/update-customer-request.model';
import { CustomerDetailLayoutResolverService } from '../../services/customer-detail-layout-resolver.service';
import { CustomerService } from '../../services/customer.service';
import { CustomerDetailComponent } from './customer-detail.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const navTreeStub = { setRecordCrumb: vi.fn() };

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
  isOnCreditHold: false,
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
        { provide: NavTreeService, useValue: navTreeStub },
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

  it('passes emptied email and phone through to the update as empty strings', () => {
    const component = setup();

    (component as unknown as { saveClusterPatch(p: Partial<CustomerSummary>): void })
      .saveClusterPatch({ name: 'Acme Co', companyName: undefined, email: '', phone: '', isActive: true });

    expect(customerService.updateCustomer).toHaveBeenCalledWith(5, expect.objectContaining({
      companyName: 'Acme Corp',
      email: '',
      phone: '',
    }));
  });

  it('names the customer in the header breadcrumb once it loads', () => {
    setup();

    expect(navTreeStub.setRecordCrumb).toHaveBeenCalledWith('Acme Co', '/customers/5');
  });
});

describe('CustomerDetailComponent · role-gated tabs', () => {
  const layout = ['overview', 'invoices', 'pricing', 'documents'].map(id => ({ id, labelKey: id }));

  function setup(roles: string[], tab = 'overview'): { tabIds: string[]; documents: boolean; rendered: string | null } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '5', tab })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NavTreeService, useValue: navTreeStub },
        { provide: CustomerService, useValue: { getCustomerSummary: () => of(CUSTOMER) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: CustomerDetailLayoutResolverService, useValue: { deriveLifecycle: () => 'active', resolve: () => layout } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CustomerDetailComponent()) as unknown as {
      tabLayout(): { id: string }[];
      canViewCommercialDocuments(): boolean;
      renderedTab(): string | null;
    };
    TestBed.flushEffects();
    return {
      tabIds: component.tabLayout().map(t => t.id),
      documents: component.canViewCommercialDocuments(),
      rendered: component.renderedTab(),
    };
  }

  it('keeps invoices, pricing and the commercial documents from a PM', () => {
    const { tabIds, documents } = setup(['PM']);

    expect(tabIds).toEqual(['overview', 'documents']);
    expect(documents).toBe(false);
  });

  it('renders nothing for a deep link to a tab the role cannot read, so its data is never requested', () => {
    expect(setup(['PM'], 'invoices').rendered).toBeNull();
    expect(setup(['PM'], 'pricing').rendered).toBeNull();
    expect(setup(['OfficeManager'], 'invoices').rendered).toBe('invoices');
  });

  it('shows them to an office manager', () => {
    const { tabIds, documents } = setup(['OfficeManager']);

    expect(tabIds).toEqual(['overview', 'invoices', 'pricing', 'documents']);
    expect(documents).toBe(true);
  });
});

describe('CustomerDetailComponent · money stats', () => {
  function render(roles: string[]): HTMLElement {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '5', tab: 'overview' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NavTreeService, useValue: navTreeStub },
        { provide: CustomerService, useValue: { getCustomerSummary: () => of(CUSTOMER) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: CustomerDetailLayoutResolverService, useValue: { deriveLifecycle: () => 'active', resolve: () => [] } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    TestBed.overrideComponent(CustomerDetailComponent, { set: { imports: [TranslatePipe], schemas: [NO_ERRORS_SCHEMA] } });
    const fixture = TestBed.createComponent(CustomerDetailComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('hides outstanding and YTD revenue from a PM, who cannot read invoices', () => {
    const el = render(['PM']);

    expect(el.querySelector('.cd-stats')).not.toBeNull();
    expect(el.querySelector('[data-testid="customer-stat-outstanding"]')).toBeNull();
    expect(el.querySelector('[data-testid="customer-stat-ytd-revenue"]')).toBeNull();
  });

  it('shows them to an office manager', () => {
    const el = render(['OfficeManager']);

    expect(el.querySelector('[data-testid="customer-stat-outstanding"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="customer-stat-ytd-revenue"]')).not.toBeNull();
  });
});

describe('CustomerDetailComponent · credit and tax terms', () => {
  function setup(roles: string[], customer: CustomerSummary = CUSTOMER) {
    const updateCustomer = vi.fn((_id: number, _request: UpdateCustomerRequest) => of(undefined));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '5', tab: 'overview' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NavTreeService, useValue: navTreeStub },
        { provide: CustomerService, useValue: { getCustomerSummary: () => of(customer), updateCustomer } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: CustomerDetailLayoutResolverService, useValue: { deriveLifecycle: () => 'active', resolve: () => [] } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CustomerDetailComponent()) as unknown as {
      saveClusterPatch(p: Partial<CustomerSummary>): void;
    };
    TestBed.flushEffects();
    return { component, updateCustomer };
  }

  it('sends credit limit and tax exemption for an office manager', () => {
    const { component, updateCustomer } = setup(['OfficeManager']);

    component.saveClusterPatch({ name: 'Acme Co', creditLimit: 25000, isTaxExempt: true, taxExemptionId: 'UT-1' });

    expect(updateCustomer).toHaveBeenCalledWith(5, expect.objectContaining({
      creditLimit: 25000, isTaxExempt: true, taxExemptionId: 'UT-1',
    }));
  });

  it('asks the server to clear a credit limit that was emptied', () => {
    const { component, updateCustomer } = setup(['OfficeManager'], { ...CUSTOMER, creditLimit: 10000 });

    component.saveClusterPatch({ name: 'Acme Co', creditLimit: null, isTaxExempt: false, taxExemptionId: '' });

    expect(updateCustomer).toHaveBeenCalledWith(5, expect.objectContaining({ clearCreditLimit: true }));
    expect(updateCustomer.mock.calls[0][1]).not.toHaveProperty('creditLimit');
  });

  it('sends changed default credit terms and asks the server to clear emptied ones', () => {
    const changed = setup(['OfficeManager'], { ...CUSTOMER, defaultCreditTerms: 'Net30' });
    changed.component.saveClusterPatch({ name: 'Acme Co', defaultCreditTerms: 'Net45' });
    expect(changed.updateCustomer).toHaveBeenCalledWith(5, expect.objectContaining({ defaultCreditTerms: 'Net45' }));

    const cleared = setup(['OfficeManager'], { ...CUSTOMER, defaultCreditTerms: 'Net30' });
    cleared.component.saveClusterPatch({ name: 'Acme Co', defaultCreditTerms: null });
    expect(cleared.updateCustomer).toHaveBeenCalledWith(5, expect.objectContaining({ clearDefaultCreditTerms: true }));
    expect(cleared.updateCustomer.mock.calls[0][1]).not.toHaveProperty('defaultCreditTerms');
  });

  it('leaves unchanged default credit terms out of the request', () => {
    const { component, updateCustomer } = setup(['OfficeManager'], { ...CUSTOMER, defaultCreditTerms: 'Net30' });

    component.saveClusterPatch({ name: 'Acme Co', defaultCreditTerms: 'Net30' });

    expect(updateCustomer.mock.calls[0][1]).not.toHaveProperty('defaultCreditTerms');
    expect(updateCustomer.mock.calls[0][1]).not.toHaveProperty('clearDefaultCreditTerms');
  });

  it('never sends credit or tax fields for a PM', () => {
    const { component, updateCustomer } = setup(['PM']);

    component.saveClusterPatch({ name: 'Acme Co', creditLimit: 25000, isTaxExempt: true, taxExemptionId: 'UT-1', defaultCreditTerms: 'Net45' });

    const request = updateCustomer.mock.calls[0][1];
    expect(request).not.toHaveProperty('defaultCreditTerms');
    expect(request).not.toHaveProperty('creditLimit');
    expect(request).not.toHaveProperty('isTaxExempt');
    expect(request).not.toHaveProperty('taxExemptionId');
  });
});

describe('CustomerDetailComponent · bad links', () => {
  function setup(id: string, getCustomerSummary: () => Observable<CustomerSummary>) {
    const navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id, tab: 'overview' })) } },
        { provide: Router, useValue: { navigate } },
        { provide: NavTreeService, useValue: { setRecordCrumb: vi.fn() } },
        { provide: CustomerService, useValue: { getCustomerSummary: vi.fn(getCustomerSummary) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: CustomerDetailLayoutResolverService, useValue: { deriveLifecycle: () => 'active', resolve: () => [] } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CustomerDetailComponent());
    TestBed.flushEffects();
    const view = component as unknown as { loading(): boolean; loadError(): unknown; reloadCustomer(): void };
    return { view, navigate, service: TestBed.inject(CustomerService) };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('shows not-found in place for a non-numeric id without calling the API', () => {
    const { view, navigate, service } = setup('abc', () => of(CUSTOMER));
    expect(view.loading()).toBe(false);
    expect((view.loadError() as HttpErrorResponse).status).toBe(404);
    expect(service.getCustomerSummary).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the page and shows the error when the customer does not exist', () => {
    const missing = new HttpErrorResponse({ status: 404 });
    const { view, navigate } = setup('999999', () => throwError(() => missing));
    expect(view.loading()).toBe(false);
    expect(view.loadError()).toBe(missing);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('loads again on retry after a failed load', () => {
    let calls = 0;
    const { view } = setup('5', () => (++calls === 1 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(CUSTOMER)));
    view.reloadCustomer();
    expect(calls).toBe(2);
    expect(view.loadError()).toBeNull();
  });
});
