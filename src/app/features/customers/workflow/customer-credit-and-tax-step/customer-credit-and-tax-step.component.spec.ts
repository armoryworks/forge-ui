import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { CustomerCreditAndTaxStepComponent } from './customer-credit-and-tax-step.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function render(roles: string[]): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CustomerCreditAndTaxStepComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const fixture = TestBed.createComponent(CustomerCreditAndTaxStepComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CustomerCreditAndTaxStepComponent commercial terms', () => {
  it('hides credit limit and tax exemption from a PM, who cannot set them', () => {
    const el = render(['PM']);

    expect(el.querySelector('[data-testid="customer-credit-limit"]')).toBeNull();
    expect(el.querySelector('[data-testid="customer-is-tax-exempt"]')).toBeNull();
    expect(el.querySelector('[data-testid="customer-default-currency"]')).not.toBeNull();
  });

  it('shows them to an office manager', () => {
    const el = render(['OfficeManager']);

    expect(el.querySelector('[data-testid="customer-credit-limit"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="customer-is-tax-exempt"]')).not.toBeNull();
  });
});
