import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { DocumentCurrencyComponent } from './document-currency.component';
import { ActiveCurrency } from '../../models/active-currency.model';
import { ActiveCurrencyService } from '../../services/active-currency.service';
import { CapabilityService } from '../../services/capability.service';
import { ExchangeRateLookupService } from '../../services/exchange-rate-lookup.service';

const USD: ActiveCurrency = { id: 1, code: 'USD', name: 'US Dollar', symbol: '$', isBaseCurrency: true };
const CAD: ActiveCurrency = { id: 2, code: 'CAD', name: 'Canadian Dollar', symbol: '$', isBaseCurrency: false };

interface Internals {
  visible(): boolean;
  isForeign(): boolean;
  selectedCode(): string | null;
  lockedLabel(): string;
  rateAsOf(): string | null;
  rateMissing(): boolean;
}

describe('DocumentCurrencyComponent', () => {
  let lookup: ReturnType<typeof vi.fn>;
  let currencies: ActiveCurrency[];

  beforeEach(() => {
    currencies = [USD, CAD];
    lookup = vi.fn(() => of({ rate: 0.73, effectiveDate: '2026-10-01', source: 'direct' }));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: ActiveCurrencyService, useValue: { listActiveCurrencies: () => of(currencies) } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: ExchangeRateLookupService, useValue: { lookup } },
      ],
    });
  });

  function create(inputs: Record<string, unknown>): Internals {
    const fixture = TestBed.createComponent(DocumentCurrencyComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    TestBed.tick();
    return fixture.componentInstance as unknown as Internals;
  }

  it('defaults an untouched currency to the party currency and pre-fills its rate', () => {
    const currency = new FormControl<number | null>(null);
    const rate = new FormControl<number | null>(1);

    const field = create({ currencyControl: currency, fxRateControl: rate, defaultCurrencyId: 2 });

    expect(currency.value).toBe(2);
    expect(field.isForeign()).toBe(true);
    expect(field.selectedCode()).toBe('CAD');
    expect(lookup).toHaveBeenCalledWith(2, null);
    expect(rate.value).toBe(0.73);
    expect(field.rateAsOf()).not.toBeNull();
  });

  it('follows a change of party until the user picks a currency, but keeps a value the form set', () => {
    const currency = new FormControl<number | null>(null);
    const fixture = TestBed.createComponent(DocumentCurrencyComponent);
    fixture.componentRef.setInput('currencyControl', currency);
    TestBed.tick();
    expect(currency.value).toBe(1);

    fixture.componentRef.setInput('defaultCurrencyId', 2);
    TestBed.tick();
    expect(currency.value).toBe(2);

    currency.setValue(1);
    fixture.componentRef.setInput('defaultCurrencyId', null);
    TestBed.tick();
    expect(currency.value).toBe(1);
  });

  it('books the functional currency at 1 with no lookup', () => {
    const currency = new FormControl<number | null>(null);
    const rate = new FormControl<number | null>(0.5);

    const field = create({ currencyControl: currency, fxRateControl: rate });

    expect(currency.value).toBe(1);
    expect(field.isForeign()).toBe(false);
    expect(rate.value).toBe(1);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('leaves the rate empty with a note when none is on file', () => {
    lookup.mockReturnValue(throwError(() => ({ status: 422 })));
    const rate = new FormControl<number | null>(1);

    const field = create({ currencyControl: new FormControl<number | null>(2), fxRateControl: rate });

    expect(rate.value).toBeNull();
    expect(field.rateMissing()).toBe(true);
  });

  it('keeps a rate the user typed', () => {
    const rate = new FormControl<number | null>(0.8);
    rate.markAsDirty();

    create({ currencyControl: new FormControl<number | null>(2), fxRateControl: rate });

    expect(rate.value).toBe(0.8);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('labels a locked party with no stored currency as the functional currency', () => {
    const currency = new FormControl<number | null>(null);

    const field = create({ currencyControl: currency, locked: true });

    expect(currency.value).toBeNull();
    expect(field.lockedLabel()).toBe('USD — US Dollar');
  });

  it('labels a read-only party with no stored currency from its default', () => {
    const field = create({ currencyControl: new FormControl<number | null>(null), readonly: true, defaultCurrencyId: 2 });

    expect(field.lockedLabel()).toBe('CAD — Canadian Dollar');
  });

  it('stays hidden on a single-currency install', () => {
    currencies = [USD];

    const field = create({ currencyControl: new FormControl<number | null>(null) });

    expect(field.visible()).toBe(false);
    expect(field.selectedCode()).toBeNull();
  });
});
