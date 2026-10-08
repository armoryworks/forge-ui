import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { CustomerAddressesStepComponent } from './customer-addresses-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('CustomerAddressesStepComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerAddressesStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    }).compileComponents();
  });

  function build(entityId: number | null, entity: unknown): CustomerAddressesStepComponent {
    const component = TestBed.runInInjectionContext(() => new CustomerAddressesStepComponent());
    mockSignalInputs(component, {
      stepId: 'addresses', componentName: 'CustomerAddressesStepComponent',
      runId: 2, entityId, entity,
    });
    return component;
  }

  function customerId(component: CustomerAddressesStepComponent): number | null {
    return (component as unknown as { customerId(): number | null }).customerId();
  }

  it('targets the customer the identity step created', () => {
    expect(customerId(build(31, null))).toBe(31);
    expect(customerId(build(null, { id: 32 }))).toBe(32);
    expect(customerId(build(null, null))).toBeNull();
  });

  it('follows the customer-addresses capability, defaulting on', () => {
    const spy = vi.spyOn(TestBed.inject(CapabilityService), 'isEnabled').mockReturnValue(false);
    const component = build(31, null);
    expect((component as unknown as { addressesEnabled(): boolean }).addressesEnabled()).toBe(false);
    expect(spy).toHaveBeenCalledWith('CAP-MD-CUSTOMER-ADDRESSES', true);
  });

  it('lets Continue through without saving anything', () => {
    build(31, null);
    let result: unknown;
    TestBed.inject(WorkflowService).saveCurrentStep().subscribe(r => (result = r));
    expect(result).toEqual({ ok: true });
  });
});
