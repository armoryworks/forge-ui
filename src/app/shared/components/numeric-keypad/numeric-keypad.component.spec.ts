import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { NumericKeypadComponent } from './numeric-keypad.component';

const ES = {
  kioskFlows: {
    keypad: {
      aria: 'Teclado numérico',
      digitAria: 'Dígito {{digit}}',
      clearAria: 'Borrar el PIN',
      backspaceAria: 'Borrar el último dígito',
      modeAlways: 'Teclado: siempre',
      modeOff: 'Teclado: apagado',
      modeAutoOn: 'Teclado: automático (encendido)',
      modeAutoOff: 'Teclado: automático (apagado)',
    },
  },
};

const MODE_KEY = 'sf-keypad-mode';

function render(mode: string) {
  localStorage.setItem(MODE_KEY, mode);
  TestBed.configureTestingModule({ imports: [NumericKeypadComponent, TranslateModule.forRoot()] });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('es', ES);
  translate.use('es');
  const fixture = TestBed.createComponent(NumericKeypadComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('NumericKeypadComponent', () => {
  let saved: string | null;

  beforeEach(() => {
    TestBed.resetTestingModule();
    saved = localStorage.getItem(MODE_KEY);
  });

  afterEach(() => {
    if (saved === null) localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, saved);
  });

  it('labels the keys and the mode toggle in Spanish', () => {
    const el = render('always');

    expect(el.querySelector('.keypad')!.getAttribute('aria-label')).toBe('Teclado numérico');
    const keys = [...el.querySelectorAll('.keypad__key')].map(k => k.getAttribute('aria-label'));
    expect(keys).toContain('Dígito 7');
    expect(keys).toContain('Dígito 0');
    expect(keys).toContain('Borrar el PIN');
    expect(keys).toContain('Borrar el último dígito');
    expect(el.querySelector('.keypad__mode-toggle')!.textContent).toContain('Teclado: siempre');
  });

  it('names the off mode in Spanish', () => {
    const el = render('never');

    expect(el.querySelector('.keypad')).toBeNull();
    expect(el.querySelector('.keypad__mode-toggle')!.getAttribute('aria-label')).toBe('Teclado: apagado');
  });
});
