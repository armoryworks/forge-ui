import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';

import { DateRange, DateRangePickerComponent } from './date-range-picker.component';

interface RangeApi {
  writeValue(value: DateRange | null): void;
  registerOnChange(fn: (value: DateRange) => void): void;
  validate(control: unknown): Record<string, { message: string }> | null;
  onStartChange(event: MatDatepickerInputEvent<Date>): void;
  onEndChange(event: MatDatepickerInputEvent<Date>): void;
  applyPreset(label: string): void;
  errorMessage(): string | null;
}

function event(value: Date | null, text: string): MatDatepickerInputEvent<Date> {
  return { value, targetElement: { value: text } } as unknown as MatDatepickerInputEvent<Date>;
}

function create(): RangeApi {
  return TestBed.runInInjectionContext(() => new DateRangePickerComponent()) as unknown as RangeApi;
}

describe('DateRangePickerComponent validation', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('passes an ordered range', () => {
    const picker = create();
    picker.writeValue({ start: new Date(2026, 8, 19), end: new Date(2026, 9, 19) });

    expect(picker.validate(null)).toBeNull();
    expect(picker.errorMessage()).toBeNull();
  });

  it('fails when From falls after To', () => {
    const picker = create();
    picker.writeValue({ start: new Date(2026, 9, 19), end: new Date(2026, 8, 19) });

    expect(Object.keys(picker.validate(null)!)).toEqual(['dateRangeOrder']);
    expect(picker.errorMessage()).toBe('validation.dateRangeOrder');
  });

  it('fails while typed text is not a real date, keeping the last good value', () => {
    const picker = create();
    const onChange = vi.fn();
    picker.registerOnChange(onChange);
    const start = new Date(2026, 9, 1);
    picker.writeValue({ start, end: new Date(2026, 9, 19) });

    picker.onEndChange(event(null, '13/45/2026'));

    expect(Object.keys(picker.validate(null)!)).toEqual(['dateRangeParse']);
    expect(onChange).toHaveBeenCalledWith({ start, end: new Date(2026, 9, 19) });
  });

  it('clears the parse error once a real date is typed or a preset is applied', () => {
    const picker = create();
    picker.onStartChange(event(null, '02/30/2026'));
    expect(picker.validate(null)).not.toBeNull();

    picker.onStartChange(event(new Date(2026, 1, 28), '02/28/2026'));
    expect(picker.validate(null)).toBeNull();

    picker.onEndChange(event(null, 'nope'));
    picker.applyPreset('This Month');
    expect(picker.validate(null)).toBeNull();
  });

  it('treats a cleared field as empty rather than invalid', () => {
    const picker = create();
    picker.writeValue({ start: new Date(2026, 9, 1), end: new Date(2026, 9, 19) });

    picker.onStartChange(event(null, ''));

    expect(picker.validate(null)).toBeNull();
  });
});
