import { Injectable, Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MatDateFormats, NativeDateAdapter } from '@angular/material/core';

import { formatDate } from './date.utils';

/** Date formats enforcing MM/dd/yyyy display (project standard). */
export const QBE_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: 'MM/dd/yyyy' },
  display: {
    dateInput: { year: 'numeric', month: '2-digit', day: '2-digit' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

const US_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Builds the local date for a typed year/month/day, or null when that calendar day does not exist
 * (02/30/2026, 13/45/2026) rather than letting it roll forward into the next month.
 */
export function strictCalendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  date.setFullYear(year);
  const roundTrips = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return roundTrips ? date : null;
}

/**
 * Parses typed text as MM/DD/YYYY (or M/D/YYYY, `-` separators allowed) or YYYY-MM-DD.
 * Returns null for empty text and an invalid Date for anything else, so the datepicker
 * raises its parse error instead of accepting a rolled-over or guessed date.
 */
export function parseStrictDate(text: string): Date | null {
  const value = text.trim();
  if (!value) return null;
  const us = US_DATE.exec(value);
  const iso = us ? null : ISO_DATE.exec(value);
  const parts = us ? [us[3], us[1], us[2]] : iso ? [iso[1], iso[2], iso[3]] : null;
  const date = parts ? strictCalendarDate(Number(parts[0]), Number(parts[1]), Number(parts[2])) : null;
  return date ?? new Date(NaN);
}

/**
 * NativeDateAdapter whose parse rejects impossible or ambiguous typed dates instead of rolling them over.
 * Month and weekday names follow the adapter locale (MAT_DATE_LOCALE, which defaults to the app LOCALE_ID),
 * while the typed date stays MM/dd/yyyy in every language.
 */
@Injectable()
export class StrictDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: object): string {
    if (displayFormat === QBE_DATE_FORMATS.display.dateInput) {
      if (!this.isValid(date)) throw Error('NativeDateAdapter: Cannot format invalid date.');
      return formatDate(date);
    }
    return super.format(date, displayFormat);
  }

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') return parseStrictDate(value);
    return super.parse(value, parseFormat);
  }
}

/** Standalone providers for the strict adapter plus the MM/dd/yyyy formats. */
export function provideStrictDateAdapter(): Provider[] {
  return [
    { provide: DateAdapter, useClass: StrictDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: QBE_DATE_FORMATS },
  ];
}
