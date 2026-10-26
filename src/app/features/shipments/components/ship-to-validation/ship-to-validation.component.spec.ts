import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ShipmentService } from '../../services/shipment.service';
import { Address, AddressValidationResult } from '../../../../shared/models/address.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ShipToValidationComponent } from './ship-to-validation.component';

const ENTERED: Address = { line1: '12 main st', line2: 'Suite 4', city: 'springfield', state: 'IL', postalCode: '62701', country: 'US' };

interface Internals {
  suggestion: Signal<Address | null>;
  result: Signal<AddressValidationResult | null>;
  validate(): void;
  useSuggestion(): void;
  keep(): void;
}

describe('ShipToValidationComponent', () => {
  const validateAddress = vi.fn();

  function create(address: Address | null = ENTERED): { c: Internals; accepted: ReturnType<typeof vi.fn> } {
    const component = TestBed.runInInjectionContext(() => new ShipToValidationComponent());
    mockSignalInputs(component, { address });
    const accepted = vi.fn();
    component.accepted.subscribe(accepted);
    return { c: component as unknown as Internals, accepted };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    validateAddress.mockReset().mockReturnValue(of({
      isValid: true, street: '12 MAIN ST', city: 'SPRINGFIELD', state: 'IL', zip: '62701-1234', country: 'US', messages: [],
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ShipmentService, useValue: { validateAddress } },
        { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
      ],
    });
  });

  it('sends the ship-to for validation and offers the standardized form', () => {
    const { c } = create();
    c.validate();
    expect(validateAddress).toHaveBeenCalledWith(ENTERED);
    expect(c.suggestion()).toEqual({ ...ENTERED, line1: '12 MAIN ST', city: 'SPRINGFIELD', postalCode: '62701-1234' });
  });

  it('accepting hands back the suggestion, keeping the suite line', () => {
    const { c, accepted } = create();
    c.validate();
    c.useSuggestion();
    expect(accepted).toHaveBeenCalledWith(expect.objectContaining({ line1: '12 MAIN ST', line2: 'Suite 4', postalCode: '62701-1234' }));
    expect(c.result()).toBeNull();
  });

  it('keeping mine dismisses the suggestion without changing anything', () => {
    const { c, accepted } = create();
    c.validate();
    c.keep();
    expect(accepted).not.toHaveBeenCalled();
    expect(c.result()).toBeNull();
  });

  it('offers no suggestion when the address already matches', () => {
    validateAddress.mockReturnValue(of({ isValid: true, street: '12 Main St', city: 'Springfield', state: 'IL', zip: '62701', country: 'US', messages: [] }));
    const { c } = create();
    c.validate();
    expect(c.suggestion()).toBeNull();
  });

  it('does not call the service for an incomplete address', () => {
    create({ ...ENTERED, city: '' }).c.validate();
    expect(validateAddress).not.toHaveBeenCalled();
  });
});
