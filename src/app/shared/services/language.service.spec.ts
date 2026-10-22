import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { formatCurrency, formatDate, formatNumber } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

import { LANGUAGE_RELOAD, LanguageService, SupportedLanguage, localeIdForStoredLanguage, storedLanguage } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let translateUseSpy: ReturnType<typeof vi.fn>;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    translateUseSpy = vi.fn();
    reloadSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: { use: translateUseSpy } },
        { provide: LANGUAGE_RELOAD, useValue: reloadSpy },
      ],
    });

    service = TestBed.inject(LanguageService);

    // Clear localStorage before each test to avoid cross-test pollution
    localStorage.removeItem('language');
  });

  afterEach(() => {
    localStorage.removeItem('language');
  });

  // ── setLanguage() ─────────────────────────────────────────────────────────

  it('setLanguage() updates the currentLanguage signal', () => {
    service.setLanguage('es');
    expect(service.currentLanguage()).toBe('es');
  });

  it('intlLocale follows the language so dates, times and money format for it', () => {
    expect(service.intlLocale()).toBe('en-US');
    service.setLanguage('es');
    expect(service.intlLocale()).toBe('es-US');
    expect(new Date(2026, 9, 19).toLocaleDateString(service.intlLocale(), { month: 'long', year: 'numeric' })).toBe('octubre de 2026');
  });

  it('setLanguage() calls translate.use() with the given language code', () => {
    service.setLanguage('es');
    expect(translateUseSpy).toHaveBeenCalledWith('es');
  });

  it('setLanguage() stores the language in localStorage', () => {
    service.setLanguage('es');
    expect(localStorage.getItem('language')).toBe('es');
  });

  it('setLanguage() sets document.documentElement.lang', () => {
    service.setLanguage('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('setLanguage("en") restores defaults', () => {
    // Switch to Spanish first
    service.setLanguage('es');
    // Then back to English
    service.setLanguage('en');

    expect(service.currentLanguage()).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(translateUseSpy).toHaveBeenLastCalledWith('en');
  });

  it('setLanguage() reloads the page when the language changes so LOCALE_ID follows it', () => {
    service.initialize();
    service.setLanguage('es');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('language')).toBe('es');
  });

  it('setLanguage() does not reload when the language is already in use', () => {
    localStorage.setItem('language', 'es');
    service.initialize();
    service.setLanguage('es');
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('initialize() never reloads', () => {
    localStorage.setItem('language', 'es');
    service.initialize();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  // ── initialize() ─────────────────────────────────────────────────────────

  it('initialize() reads the saved language from localStorage', () => {
    localStorage.setItem('language', 'es');
    service.initialize();

    expect(service.currentLanguage()).toBe('es');
    expect(translateUseSpy).toHaveBeenCalledWith('es');
  });

  it('initialize() defaults to "en" when nothing is saved in localStorage', () => {
    localStorage.removeItem('language');
    service.initialize();

    expect(service.currentLanguage()).toBe('en');
    expect(translateUseSpy).toHaveBeenCalledWith('en');
  });

  it('initialize() stores the resolved language back into localStorage', () => {
    localStorage.removeItem('language');
    service.initialize();

    expect(localStorage.getItem('language')).toBe('en');
  });

  // ── availableLanguages ────────────────────────────────────────────────────

  it('availableLanguages contains "en" and "es" entries', () => {
    const codes = service.availableLanguages.map(l => l.code) as SupportedLanguage[];
    expect(codes).toContain('en');
    expect(codes).toContain('es');
    expect(service.availableLanguages).toHaveLength(2);
  });

  it('availableLanguages has correct labels', () => {
    const en = service.availableLanguages.find(l => l.code === 'en');
    const es = service.availableLanguages.find(l => l.code === 'es');
    expect(en?.label).toBe('English');
    expect(es?.label).toBe('Español');
  });

  it('storedLanguage() falls back to en for a missing or unsupported value', () => {
    expect(storedLanguage()).toBe('en');
    localStorage.setItem('language', 'fr');
    expect(storedLanguage()).toBe('en');
    localStorage.setItem('language', 'es');
    expect(storedLanguage()).toBe('es');
  });

  it('localeIdForStoredLanguage() is en-US by default and es-US for Spanish', () => {
    expect(localeIdForStoredLanguage()).toBe('en-US');
    localStorage.setItem('language', 'es');
    expect(localeIdForStoredLanguage()).toBe('es-US');
  });

  it('es-US keeps US numeric conventions while naming months in Spanish', () => {
    localStorage.setItem('language', 'es');
    const locale = localeIdForStoredLanguage();
    expect(formatNumber(1234.5, locale, '1.2-2')).toBe('1,234.50');
    expect(formatCurrency(1234.5, locale, '$', 'USD')).toBe('$1,234.50');
    expect(formatDate(new Date(2026, 9, 19), 'MM/dd/yyyy', locale)).toBe('10/19/2026');
    expect(formatDate(new Date(2026, 9, 19), 'MMMM', locale)).toBe('octubre');
  });

  // ── default signal state ──────────────────────────────────────────────────

  it('currentLanguage signal defaults to "en" before any call', () => {
    expect(service.currentLanguage()).toBe('en');
  });
});
