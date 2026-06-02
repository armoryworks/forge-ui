import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { AutocompleteComponent, AutocompleteOption } from './autocomplete.component';

/**
 * Regression: selecting an option makes mat-autocomplete write the chosen
 * option OBJECT into the bound control (the <mat-option [value]="opt">), so the
 * search stream momentarily carries a non-string. filteredOptions() must not
 * call .toLowerCase() on it (the recurring `t.toLowerCase is not a function`
 * TypeError that broke the part picker on the second selection).
 */
describe('AutocompleteComponent · filteredOptions', () => {
  const OPTIONS: AutocompleteOption[] = [
    { value: 1, label: 'RAW-00001 — Hourly' },
    { value: 2, label: 'PRT-00001 — On Site' },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let comp: any;

  beforeEach(() => {
    // Disable auto change-detection so the template never renders — we read the
    // filteredOptions computed directly, which avoids needing the full Material
    // template (and its required `label` input) to render.
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations(), { provide: ComponentFixtureAutoDetect, useValue: false }],
    });
    const fixture = TestBed.createComponent(AutocompleteComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Part');
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('displayField', 'label');
    fixture.componentRef.setInput('valueField', 'value');
    fixture.componentRef.setInput('minChars', 0);
  });

  it('does not throw when the control holds a selected option object', () => {
    // Simulate mat-autocomplete's writeback of the whole option object.
    comp.searchControl.setValue({ value: 1, label: 'RAW-00001 — Hourly' });
    expect(() => comp.filteredOptions()).not.toThrow();
    // A non-string query is treated as empty → all options stay selectable.
    expect(comp.filteredOptions().length).toBe(2);
  });

  it('still filters by a typed string query', () => {
    comp.searchControl.setValue('PRT');
    expect(comp.filteredOptions().map((o: AutocompleteOption) => o['value'])).toEqual([2]);
  });

  it('is resilient to a numeric control value', () => {
    comp.searchControl.setValue(42 as unknown as string);
    expect(() => comp.filteredOptions()).not.toThrow();
  });
});
