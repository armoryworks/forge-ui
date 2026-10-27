import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Signal } from '@angular/core';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ConfiguratorDetail } from '../../models/configurator-detail.model';
import { CpqResult } from '../../models/cpq-result.model';
import { CpqService } from '../../services/cpq.service';
import { ConfigureQuoteDialogComponent } from './configure-quote-dialog.component';

interface DialogInternals {
  ngOnInit(): void;
  configuratorControl: FormControl<number | null>;
  customerControl: FormControl<number | null>;
  createPartControl: FormControl<boolean>;
  quoteViolations: Signal<string[]>;
  partViolations: Signal<string[]>;
  onSelection(s: { selections: Record<string, string>; quantity: number }): void;
  onResult(r: CpqResult | null): void;
  generateQuote(): void;
  generatePart(): void;
}

const DETAIL = { id: 3, name: 'Bracket builder', options: [] } as unknown as ConfiguratorDetail;
const VALID = { isValid: true, validationErrors: [] } as unknown as CpqResult;

function create(service: Partial<Record<keyof CpqService, unknown>>): { dialog: DialogInternals; component: ConfigureQuoteDialogComponent } {
  TestBed.configureTestingModule({
    providers: [
      { provide: CpqService, useValue: {
        getConfigurators: () => of([{ id: 3, name: 'Bracket builder', basePartNumber: 'BRK-100' }]),
        getConfigurator: () => of(DETAIL),
        ...service,
      } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ConfigureQuoteDialogComponent());
  mockSignalInputs(component, { configuratorId: null, allowQuote: true });
  const dialog = component as unknown as DialogInternals;
  dialog.ngOnInit();
  return { dialog, component };
}

describe('ConfigureQuoteDialogComponent', () => {
  it('needs a configurator, a customer and a valid price before it creates a quote', () => {
    const { dialog } = create({});
    expect(dialog.quoteViolations()).toEqual(['cpq.configure.pickConfigurator', 'cpq.configure.pickCustomer']);
    dialog.configuratorControl.setValue(3);
    expect(dialog.quoteViolations()).toContain('cpq.configure.notPriced');
    dialog.onResult({ isValid: false, validationErrors: ['Color is required.'] } as CpqResult);
    expect(dialog.partViolations()).toEqual(['Color is required.']);
  });

  it('saves the configuration, then creates the quote (and the part when asked)', () => {
    const saveConfiguration = vi.fn(() => of({ id: 55 }));
    const generateQuote = vi.fn(() => of({ quoteId: 9 }));
    const { dialog, component } = create({ saveConfiguration, generateQuote });
    const created = vi.fn();
    component.quoteCreated.subscribe(created);

    dialog.configuratorControl.setValue(3);
    dialog.customerControl.setValue(21);
    dialog.onSelection({ selections: { Color: 'Red' }, quantity: 4 });
    dialog.onResult(VALID);
    dialog.generateQuote();

    expect(saveConfiguration).toHaveBeenCalledWith(3, { Color: 'Red' }, 4);
    expect(generateQuote).toHaveBeenCalledWith(55, 21, true);
    expect(created).toHaveBeenCalledWith(9);
  });

  it('creates only the configured part without a customer', () => {
    const saveConfiguration = vi.fn(() => of({ id: 56 }));
    const generatePart = vi.fn(() => of({ partId: 77 }));
    const { dialog, component } = create({ saveConfiguration, generatePart });
    const created = vi.fn();
    component.partCreated.subscribe(created);

    dialog.configuratorControl.setValue(3);
    dialog.onSelection({ selections: {}, quantity: 1 });
    dialog.onResult(VALID);
    dialog.generatePart();

    expect(generatePart).toHaveBeenCalledWith(56);
    expect(created).toHaveBeenCalledWith(77);
  });
});
