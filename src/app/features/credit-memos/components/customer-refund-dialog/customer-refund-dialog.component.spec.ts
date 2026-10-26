import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { CustomerRefundDialogComponent } from './customer-refund-dialog.component';
import { CurrencyService } from '../../../../shared/services/currency.service';

interface DialogInternals {
  form: {
    controls: { amount: { value: number | null; setValue(v: number): void; valid: boolean } };
    patchValue(value: Record<string, unknown>): void;
    invalid: boolean;
  };
  submitted: { subscribe(fn: (value: unknown) => void): void };
  submit(): void;
  ngOnInit(): void;
}

describe('CustomerRefundDialogComponent', () => {
  let dialog: DialogInternals;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CurrencyService, useValue: { baseCurrency: signal('USD') } },
      ],
    });
    dialog = TestBed.runInInjectionContext(() => new CustomerRefundDialogComponent()) as unknown as DialogInternals;
    const component = dialog as unknown as { maxAmount: () => number; currencyCode: () => string | null; defaultFxRate: () => number; saving: () => boolean; title: () => string };
    Object.assign(component, {
      maxAmount: () => 80,
      currencyCode: () => 'USD',
      defaultFxRate: () => 1,
      saving: () => false,
      title: () => 'Refund',
    });
    dialog.ngOnInit();
  });

  it('defaults to the whole open amount and emits the refund', () => {
    expect(dialog.form.controls.amount.value).toBe(80);
    const emitted = vi.fn();
    dialog.submitted.subscribe(emitted);
    dialog.form.patchValue({ reference: 'CHK 1001' });

    dialog.submit();

    expect(emitted).toHaveBeenCalledWith(expect.objectContaining({ amount: 80, method: 'Check', reference: 'CHK 1001', settlementFxRate: null }));
  });

  it('refuses more than is open', () => {
    dialog.form.controls.amount.setValue(81);
    expect(dialog.form.invalid).toBe(true);
  });
});
