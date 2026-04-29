import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PartDetail } from '../../models/part-detail.model';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartBasicsStepComponent } from './part-basics-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildPart(overrides: Partial<PartDetail> = {}): PartDetail {
  return {
    id: 42, partNumber: 'PRT-00042', description: 'Widget', revision: 'A',
    status: 'Draft', partType: 'Assembly', material: 'Steel',
    moldToolRef: null, externalPartNumber: null, externalId: null, externalRef: null,
    provider: null, preferredVendorId: null, preferredVendorName: null,
    minStockThreshold: null, reorderPoint: null, reorderQuantity: null,
    leadTimeDays: null, safetyStockDays: null, isSerialTracked: false,
    toolingAssetId: null, toolingAssetName: null,
    manualCostOverride: null, currentCostCalculationId: null,
    bomEntries: [], usedIn: [],
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

describe('PartBasicsStepComponent (Phase 5)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartBasicsStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('hydrates the form from the entity input', () => {
    const component = TestBed.runInInjectionContext(() => new PartBasicsStepComponent());
    mockSignalInputs(component, {
      stepId: 'basics', componentName: 'PartBasicsStepComponent',
      entityId: 42, entity: buildPart({ description: 'Hydration', material: 'Aluminum' }),
    });
    // Trigger effect by reading the form
    TestBed.flushEffects();
    const form = (component as unknown as { form: { value: unknown } }).form;
    expect(form.value).toMatchObject({
      description: 'Hydration',
      material: 'Aluminum',
      partType: 'Assembly',
    });
  });

  it('dispatches a PATCH /parts/:id on form change after debounce', async () => {
    vi.useFakeTimers();
    try {
      const component = TestBed.runInInjectionContext(() => new PartBasicsStepComponent());
      mockSignalInputs(component, {
        stepId: 'basics', componentName: 'PartBasicsStepComponent',
        entityId: 42, entity: buildPart({ description: 'Initial', material: 'Steel' }),
      });
      TestBed.flushEffects();

      const form = (component as unknown as { form: { patchValue(v: unknown): void } }).form;
      form.patchValue({ description: 'Updated description' });

      // Debounce 600ms
      vi.advanceTimersByTime(700);

      const req = httpMock.expectOne(`${environment.apiUrl}/parts/42`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.description).toBe('Updated description');
      req.flush(buildPart({ description: 'Updated description' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
