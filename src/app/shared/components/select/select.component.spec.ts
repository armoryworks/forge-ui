import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { SelectComponent } from './select.component';

interface SelectView {
  selectionChange: { subscribe(fn: (value: unknown) => void): unknown };
  registerOnChange(fn: (value: unknown) => void): void;
  onSelectionChange(value: unknown): void;
  writeValue(value: unknown): void;
}

describe('SelectComponent', () => {
  function create(): SelectView {
    TestBed.resetTestingModule();
    return TestBed.runInInjectionContext(() => new SelectComponent()) as unknown as SelectView;
  }

  it('emits selectionChange after the form control has the new value', () => {
    const select = create();
    let controlValue: unknown = 'All';
    const seen: unknown[] = [];
    select.registerOnChange(value => { controlValue = value; });
    select.selectionChange.subscribe(value => seen.push([value, controlValue]));

    select.onSelectionChange('Open');

    expect(seen).toEqual([['Open', 'Open']]);
  });

  it('does not emit when the value is written from the form', () => {
    const select = create();
    const listener = vi.fn();
    select.selectionChange.subscribe(listener);

    select.writeValue('Closed');

    expect(listener).not.toHaveBeenCalled();
  });
});
