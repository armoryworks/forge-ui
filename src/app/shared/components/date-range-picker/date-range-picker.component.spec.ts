import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { DateRangePickerComponent, resolveDateRangePreset } from './date-range-picker.component';

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
