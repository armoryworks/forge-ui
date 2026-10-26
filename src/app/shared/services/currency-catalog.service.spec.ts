import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ActiveCurrency } from '../models/active-currency.model';
import { ActiveCurrencyService } from './active-currency.service';
import { CapabilityService } from './capability.service';
import { CurrencyCatalogService } from './currency-catalog.service';

const USD: ActiveCurrency = { id: 1, code: 'USD', name: 'US Dollar', symbol: '$', isBaseCurrency: true };
const CAD: ActiveCurrency = { id: 2, code: 'CAD', name: 'Canadian Dollar', symbol: '$', isBaseCurrency: false };

describe('CurrencyCatalogService', () => {
  const listActiveCurrencies = vi.fn();
  let capabilityOn = true;

  beforeEach(() => {
    listActiveCurrencies.mockReset();
    capabilityOn = true;
    TestBed.configureTestingModule({
      providers: [
        { provide: ActiveCurrencyService, useValue: { listActiveCurrencies } },
        { provide: CapabilityService, useValue: { isEnabled: () => capabilityOn } },
      ],
    });
  });

  it('loads the catalog once however many callers ask', () => {
    listActiveCurrencies.mockReturnValue(of([USD, CAD]));
    const service = TestBed.inject(CurrencyCatalogService);

    service.ensureLoaded();
    service.ensureLoaded();

    expect(listActiveCurrencies).toHaveBeenCalledTimes(1);
    expect(service.currencies()).toEqual([USD, CAD]);
  });

  it('is multi-currency only with two active currencies and CAP-MD-CURRENCIES on', () => {
    listActiveCurrencies.mockReturnValue(of([USD, CAD]));
    const service = TestBed.inject(CurrencyCatalogService).ensureLoaded();
    expect(service.isMultiCurrency()).toBe(true);
  });

  it('is single-currency with one active currency', () => {
    listActiveCurrencies.mockReturnValue(of([USD]));
    const service = TestBed.inject(CurrencyCatalogService).ensureLoaded();
    expect(service.isMultiCurrency()).toBe(false);
  });

  it('is single-currency when CAP-MD-CURRENCIES is off', () => {
    capabilityOn = false;
    listActiveCurrencies.mockReturnValue(of([USD, CAD]));
    const service = TestBed.inject(CurrencyCatalogService).ensureLoaded();
    expect(service.isMultiCurrency()).toBe(false);
  });
});
