import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CustomerIdentityClusterComponent } from './customer-identity-cluster.component';
import { CustomerSummary } from '../../models/customer-summary.model';
import { environment } from '../../../../../environments/environment';
import { SEEDED_PAYMENT_TERMS } from '../../../../shared/models/payment-terms.fixture';

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
        provideHttpClientTesting(),
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

  it('emits empty strings for emptied email and phone so the save clears them', () => {
    const component = TestBed.runInInjectionContext(() => new CustomerIdentityClusterComponent());
    mockSignalInputs(component, {
      customer: makeSummary(),
      editing: true,
      saving: false,
    });
    TestBed.flushEffects();
    const c = component as unknown as {
      form: { patchValue(v: Record<string, unknown>): void };
      onSave(): void;
    };
    c.form.patchValue({ companyName: '', email: '', phone: '  ' });
    const cb = vi.fn();
    component.save.subscribe(cb);
    c.onSave();
    expect(cb.mock.calls[0][0]).toEqual(expect.objectContaining({ email: '', phone: '' }));
    expect(cb.mock.calls[0][0].companyName).toBeUndefined();
  });

  describe('credit and tax terms', () => {
    type Internals = {
      form: {
        patchValue(v: Record<string, unknown>): void;
        getRawValue(): { paymentTermsId: number | null };
        invalid: boolean;
        controls: { taxExemptionId: { hasError(code: string): boolean } };
      };
      onSave(): void;
    };

    function build(canEditCommercialTerms: boolean, creditLimitsEnabled = true, overrides: Partial<CustomerSummary> = {}) {
      const component = TestBed.runInInjectionContext(() => new CustomerIdentityClusterComponent());
      mockSignalInputs(component, {
        customer: makeSummary(overrides),
        editing: true,
        saving: false,
        canEditCommercialTerms,
        creditLimitsEnabled,
      });
      TestBed.flushEffects();
      const cb = vi.fn();
      component.save.subscribe(cb);
      return { c: component as unknown as Internals, cb };
    }

    it('loads the customer\'s credit limit and exemption into the form and saves edits', () => {
      const { c, cb } = build(true, true, { creditLimit: 10000, isTaxExempt: false });
      c.form.patchValue({ creditLimit: 25000, isTaxExempt: true, taxExemptionId: ' UT-12345 ' });

      c.onSave();

      expect(cb.mock.calls[0][0]).toEqual(expect.objectContaining({
        creditLimit: 25000, isTaxExempt: true, taxExemptionId: 'UT-12345',
      }));
    });

    it('requires an exemption ID once the customer is marked tax exempt', () => {
      const { c, cb } = build(true);
      c.form.patchValue({ isTaxExempt: true, taxExemptionId: '' });

      expect(c.form.controls.taxExemptionId.hasError('required')).toBe(true);
      c.onSave();
      expect(cb).not.toHaveBeenCalled();
    });

    it('leaves the credit limit out when credit limits are switched off', () => {
      const { c, cb } = build(true, false);

      c.onSave();

      expect(cb.mock.calls[0][0]).not.toHaveProperty('creditLimit');
      expect(cb.mock.calls[0][0]).toHaveProperty('isTaxExempt', false);
    });

    it('sends no credit or tax fields for roles that cannot change them', () => {
      const { c, cb } = build(false);

      c.onSave();

      const patch = cb.mock.calls[0][0];
      expect(patch).not.toHaveProperty('creditLimit');
      expect(patch).not.toHaveProperty('isTaxExempt');
      expect(patch).not.toHaveProperty('taxExemptionId');
      expect(patch).not.toHaveProperty('paymentTermsId');
    });

    it('maps legacy default credit terms to their payment terms and saves a new pick', () => {
      const { c, cb } = build(true, true, { defaultCreditTerms: 'Net30' });
      TestBed.inject(HttpTestingController)
        .match(r => r.url === `${environment.apiUrl}/payment-terms`).forEach(r => r.flush(SEEDED_PAYMENT_TERMS));
      TestBed.flushEffects();
      expect(c.form.getRawValue().paymentTermsId).toBe(4);
      c.form.patchValue({ paymentTermsId: 9 });

      c.onSave();

      expect(cb.mock.calls[0][0]).toEqual(expect.objectContaining({ paymentTermsId: 9 }));
    });
  });
});
