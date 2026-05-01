import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CustomerIdentityClusterComponent } from './customer-identity-cluster.component';
import { CustomerSummary } from '../../models/customer-summary.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function makeSummary(overrides: Partial<CustomerSummary> = {}): CustomerSummary {
  return {
    id: 1,
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
    ...overrides,
  };
}

describe('CustomerIdentityClusterComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CustomerIdentityClusterComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
  });

  it('reads required identity fields off the bound customer input', () => {
    const component = TestBed.runInInjectionContext(() => new CustomerIdentityClusterComponent());
    mockSignalInputs(component, {
      customer: makeSummary({ name: 'Globex', companyName: 'Globex Industries' }),
      editing: false,
      saving: false,
    });
    expect(component.customer().name).toBe('Globex');
    expect(component.customer().companyName).toBe('Globex Industries');
  });

  it('disables the form when not editing and enables it when editing', () => {
    const component = TestBed.runInInjectionContext(() => new CustomerIdentityClusterComponent());
    const inputs = mockSignalInputs(component, {
      customer: makeSummary(),
      editing: false,
      saving: false,
    });
    const form = (component as unknown as { form: { disabled: boolean; enabled: boolean } }).form;
    TestBed.flushEffects();
    expect(form.disabled).toBe(true);
    inputs.editing.set(true);
    TestBed.flushEffects();
    expect(form.enabled).toBe(true);
  });

  it('emits the patched values via save output when onSave fires with valid form', () => {
    const component = TestBed.runInInjectionContext(() => new CustomerIdentityClusterComponent());
    mockSignalInputs(component, {
      customer: makeSummary({ name: 'Original' }),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: Record<string, unknown>): void; markAllAsTouched(): void };
      onSave(): void;
    };
    c.form.patchValue({ name: 'Renamed' });
    const cb = vi.fn();
    component.save.subscribe(cb);
    c.onSave();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].name).toBe('Renamed');
  });
});
