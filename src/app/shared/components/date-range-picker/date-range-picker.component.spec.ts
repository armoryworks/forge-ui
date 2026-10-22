import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { DateRange, DateRangePickerComponent, resolveDateRangePreset } from './date-range-picker.component';

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

  it('fails a typed date outside [min]/[max]', () => {
    TestBed.overrideComponent(DateRangePickerComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(DateRangePickerComponent);
    fixture.componentRef.setInput('min', new Date(2026, 0, 1));
    fixture.componentRef.setInput('max', new Date(2026, 11, 31));
    const picker = fixture.componentInstance as unknown as RangeApi;

    picker.writeValue({ start: new Date(2026, 0, 1), end: new Date(2026, 11, 31, 23, 59) });
    expect(picker.validate(null)).toBeNull();

    picker.onStartChange(event(new Date(2025, 11, 31), '12/31/2025'));
    expect(Object.keys(picker.validate(null)!)).toEqual(['dateRangeMin']);

    picker.onStartChange(event(new Date(2026, 5, 1), '06/01/2026'));
    picker.onEndChange(event(new Date(2027, 0, 1), '01/01/2027'));
    expect(Object.keys(picker.validate(null)!)).toEqual(['dateRangeMax']);
    expect(picker.errorMessage()).toBe('validation.dateMax');
  });

  it('treats a cleared field as empty rather than invalid', () => {
    const picker = create();
    picker.writeValue({ start: new Date(2026, 9, 1), end: new Date(2026, 9, 19) });

    picker.onStartChange(event(null, ''));

    expect(picker.validate(null)).toBeNull();
  });
});

describe('resolveDateRangePreset', () => {
  it('makes Last 30 Days thirty calendar days ending today', () => {
    const { start, end } = resolveDateRangePreset('Last 30 Days');
    const today = new Date();
    expect(end).toEqual(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    const days = Math.round((end!.getTime() - start!.getTime()) / 86_400_000) + 1;
    expect(days).toBe(30);
  });

  it('returns an empty range for an unknown preset', () => {
    expect(resolveDateRangePreset('Someday')).toEqual({ start: null, end: null });
  });
});

describe('DateRangePickerComponent presets', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {
      common: { from: 'Desde', to: 'Hasta' },
      dateRange: { presets: { last30Days: 'Últimos 30 días', thisMonth: 'Este mes' } },
    });
    translate.use('es');
  });

  it('shows translated preset buttons while keeping the preset ids as the logic keys', () => {
    const fixture = TestBed.createComponent(DateRangePickerComponent);
    fixture.componentRef.setInput('presets', ['Last 30 Days', 'This Month']);
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.date-range__preset') as NodeListOf<HTMLButtonElement>);
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['Últimos 30 días', 'Este mes']);

    let emitted: { start: Date | null; end: Date | null } | null = null;
    fixture.componentInstance.registerOnChange(v => (emitted = v));
    buttons[0].click();
    expect(emitted).toEqual(resolveDateRangePreset('Last 30 Days'));
  });
});
