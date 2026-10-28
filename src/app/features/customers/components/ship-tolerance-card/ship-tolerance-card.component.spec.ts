import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { FormGroup } from '@angular/forms';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerSummary } from '../../models/customer-summary.model';
import { CustomerService } from '../../services/customer.service';
import { ShipToleranceCardComponent } from './ship-tolerance-card.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface CardInternals {
  form: FormGroup;
  save(): void;
}

function setup(customer: Partial<CustomerSummary>) {
  const updateCustomer = vi.fn(() => of(undefined));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: CustomerService, useValue: { updateCustomer } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const card = TestBed.runInInjectionContext(() => new ShipToleranceCardComponent());
  mockSignalInputs(card, { customer: { id: 7, ...customer } as CustomerSummary });
  const form = (card as unknown as CardInternals).form;
  form.reset({ over: customer.overShipTolerancePct ?? null, under: customer.underShipTolerancePct ?? null });
  return { card: card as unknown as CardInternals, form, updateCustomer };
}

describe('ShipToleranceCardComponent', () => {
  it('saves set values and clears blank ones back to the company default', () => {
    const { card, form, updateCustomer } = setup({ overShipTolerancePct: 5, underShipTolerancePct: 5 });

    form.controls['over'].setValue(10);
    form.controls['under'].setValue(null);
    form.markAsDirty();
    card.save();

    expect(updateCustomer).toHaveBeenCalledWith(7, { overShipTolerancePct: 10, clearUnderShipTolerance: true });
  });

  it('does not save an untouched or invalid form', () => {
    const { card, form, updateCustomer } = setup({});

    card.save();
    form.controls['under'].setValue(150);
    form.markAsDirty();
    card.save();

    expect(updateCustomer).not.toHaveBeenCalled();
  });
});
