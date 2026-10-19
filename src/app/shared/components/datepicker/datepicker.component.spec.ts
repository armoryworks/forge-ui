import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { DatepickerComponent } from './datepicker.component';

interface PickerApi {
  internalControl: FormControl<Date | null>;
  writeValue(value: Date | string | null): void;
}

describe('DatepickerComponent.writeValue west of UTC', () => {
  let originalTz: string | undefined;

  function create(): PickerApi {
    TestBed.resetTestingModule();
    TestBed.overrideComponent(DatepickerComponent, { set: { template: '', imports: [] } });
    return TestBed.createComponent(DatepickerComponent).componentInstance as unknown as PickerApi;
  }

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it.each([
    ['a date-only string', '2026-11-20'],
    ['a UTC-midnight string', '2026-11-20T00:00:00Z'],
    ['a UTC-midnight Date', new Date('2026-11-20T00:00:00Z')],
  ])('shows the stored calendar day for %s', (_label, value) => {
    const picker = create();

    picker.writeValue(value);

    const shown = picker.internalControl.value!;
    expect([shown.getFullYear(), shown.getMonth(), shown.getDate()]).toEqual([2026, 10, 20]);
  });

  it('keeps a picked local date and does not share the parent instance', () => {
    const picker = create();
    const picked = new Date(2026, 10, 20);

    picker.writeValue(picked);

    expect(picker.internalControl.value!.getTime()).toBe(picked.getTime());
    expect(picker.internalControl.value).not.toBe(picked);
  });

  it('clears on null', () => {
    const picker = create();

    picker.writeValue(null);

    expect(picker.internalControl.value).toBeNull();
  });
});
