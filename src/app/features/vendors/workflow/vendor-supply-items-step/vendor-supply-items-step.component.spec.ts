import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { VendorSupplyItemsStepComponent } from './vendor-supply-items-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('VendorSupplyItemsStepComponent', () => {
  let httpMock: HttpTestingController;
  let workflowService: WorkflowService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorSupplyItemsStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    workflowService = TestBed.inject(WorkflowService);
  });

  afterEach(() => httpMock.verify());

  function build(entityId: number | null): VendorSupplyItemsStepComponent {
    const component = TestBed.runInInjectionContext(() => new VendorSupplyItemsStepComponent());
    mockSignalInputs(component, {
      stepId: 'supplyItems', componentName: 'VendorSupplyItemsStepComponent',
      runId: 3, entityId, entity: null,
    });
    TestBed.tick();
    return component;
  }

  function form(component: VendorSupplyItemsStepComponent) {
    return (component as unknown as { form: VendorSupplyItemsStepComponent['form'] }).form;
  }

  it('makes no calls before the vendor exists', () => {
    build(null);
    httpMock.expectNone(() => true);
  });

  it('loads the vendor\'s existing supply items', () => {
    build(9);
    httpMock.expectOne(`${environment.apiUrl}/vendors/9/vendor-parts`).flush([]);
  });

  it('continuing with no part picked saves nothing', () => {
    build(9);
    httpMock.expectOne(`${environment.apiUrl}/vendors/9/vendor-parts`).flush([]);
    let result: unknown;
    workflowService.saveCurrentStep().subscribe(r => (result = r));
    expect(result).toEqual({ ok: true });
  });

  it('continuing with a part picked creates the vendor part and its quantity-1 price', () => {
    const component = build(9);
    httpMock.expectOne(`${environment.apiUrl}/vendors/9/vendor-parts`).flush([]);
    form(component).setValue({ partId: 77, vendorPartNumber: ' ACME-1 ', unitPrice: 4.5, leadTimeDays: 10 });
    form(component).markAsDirty();

    let result: unknown;
    workflowService.saveCurrentStep().subscribe(r => (result = r));

    const create = httpMock.expectOne(`${environment.apiUrl}/vendor-parts`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(expect.objectContaining({
      vendorId: 9, partId: 77, vendorPartNumber: 'ACME-1', leadTimeDays: 10, isApproved: true, isPreferred: false,
    }));
    create.flush({ id: 501 });

    const tier = httpMock.expectOne(`${environment.apiUrl}/vendor-parts/501/price-tiers`);
    expect(tier.request.body).toEqual({ minQuantity: 1, unitPrice: 4.5 });
    tier.flush({ id: 1 });

    httpMock.expectOne(`${environment.apiUrl}/vendors/9/vendor-parts`).flush([]);
    expect(result).toEqual({ ok: true });
    expect(form(component).controls.partId.value).toBeNull();
  });

  it('skips the price call when no price is entered', () => {
    const component = build(9);
    httpMock.expectOne(`${environment.apiUrl}/vendors/9/vendor-parts`).flush([]);
    form(component).setValue({ partId: 77, vendorPartNumber: '', unitPrice: null, leadTimeDays: null });

    workflowService.saveCurrentStep().subscribe();

    const create = httpMock.expectOne(`${environment.apiUrl}/vendor-parts`);
    expect(create.request.body).toEqual(expect.objectContaining({ vendorPartNumber: null, leadTimeDays: null }));
    create.flush({ id: 502 });
    httpMock.expectNone(`${environment.apiUrl}/vendor-parts/502/price-tiers`);
    httpMock.expectOne(`${environment.apiUrl}/vendors/9/vendor-parts`).flush([]);
  });
});
