import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';

import { LanguageService, SupportedLanguage } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let translateUseSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    translateUseSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: { use: translateUseSpy } },
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

  // ── default signal state ──────────────────────────────────────────────────

  it('currentLanguage signal defaults to "en" before any call', () => {
    expect(service.currentLanguage()).toBe('en');
  });
});
