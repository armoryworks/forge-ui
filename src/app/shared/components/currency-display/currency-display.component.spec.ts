import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { CurrencyDisplayComponent } from './currency-display.component';
import { CurrencyService } from '../../services/currency.service';

class StubCurrencyService {
  private readonly _base = signal<string>('USD');
  readonly baseCurrency = this._base.asReadonly();
  setBase(code: string): void { this._base.set(code); }
}

interface Inputs {
  value: WritableSignal<number>;
  currency: WritableSignal<string | null>;
  showCodeWhenBase: WritableSignal<boolean>;
}

interface Setup {
  component: CurrencyDisplayComponent;
  inputs: Inputs;
  stub: StubCurrencyService;
  /** Reads the rendered text by reaching the computed signal directly. */
  text(): string;
}

function setup(initialBase: string = 'USD'): Setup {
  const stub = new StubCurrencyService();
  stub.setBase(initialBase);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CurrencyService, useValue: stub },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new CurrencyDisplayComponent());
  const inputs = mockSignalInputs(component, {
    value: 0 as number,
    currency: null as string | null,
    showCodeWhenBase: false as boolean,
  });
  // Read the protected `formatted` computed by name. Tests verify the
  // string the template would render — equivalent verification because
  // the template binding is a single `{{ formatted() }}`.
  const c = component as unknown as { formatted: () => string };
  return { component, inputs, stub, text: () => c.formatted() };
}

describe('CurrencyDisplayComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders explicit currency = base without code suffix', () => {
    const { inputs, text } = setup('USD');
    inputs.value.set(12.5);
    inputs.currency.set('USD');

    expect(text()).toContain('12.50');
    expect(text()).not.toContain('USD');
  });

  it('renders explicit currency ≠ base with code suffix', () => {
    const { inputs, text } = setup('USD');
    inputs.value.set(1.5);
    inputs.currency.set('EUR');

    expect(text().endsWith('EUR')).toBe(true);
  });

  it('uses base when record currency is null, no suffix', () => {
    const { inputs, text } = setup('USD');
    inputs.value.set(9);
    inputs.currency.set(null);

    expect(text()).toContain('9');
    expect(text()).not.toContain('USD');
  });

  it('shows the code when showCodeWhenBase is true even on a match', () => {
    const { inputs, text } = setup('USD');
    inputs.value.set(4);
    inputs.currency.set('USD');
    inputs.showCodeWhenBase.set(true);

    expect(text().endsWith('USD')).toBe(true);
  });

  it('falls back to base when the record currency code is malformed', () => {
    const { inputs, text } = setup('USD');
    inputs.value.set(7);
    inputs.currency.set('NOT-A-CODE');

    expect(text()).toContain('7');
    expect(text().endsWith('USD')).toBe(true);
  });
});
