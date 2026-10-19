import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Component, ViewChild } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { CurrencyInputComponent } from './currency-input.component';
import { LanguageService } from '../../services/language.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CurrencyInputComponent],
  template: `<app-currency-input label="Amount" [formControl]="control" />`,
})
class HostComponent {
  control = new FormControl<number | null>(null);
  @ViewChild(CurrencyInputComponent) currency!: CurrencyInputComponent;
}

function setup() {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [provideAnimations()],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

describe('CurrencyInputComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the label and default $ symbol', () => {
    const { fixture } = setup();
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Amount');
    expect(html).toContain('$');
  });

  it('writes a numeric value into the input via writeValue', () => {
    const { fixture, host } = setup();
    host.control.setValue(42.5);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe('42.50');
  });

  it.each([
    [74, '74.00'],
    [12.345, '12.345'],
    [0.3334, '0.3334'],
  ])('shows %s with at least two decimals and without rounding', (value, shown) => {
    const { fixture, host } = setup();
    host.control.setValue(value);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe(shown);
  });

  it('clears the input when control is set to null', () => {
    const { fixture, host } = setup();
    host.control.setValue(10);
    fixture.detectChanges();
    host.control.setValue(null);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe('');
  });

  it('emits the parsed numeric value through registerOnChange', () => {
    const { fixture, host } = setup();
    const onChange = vi.fn();
    host.currency.registerOnChange(onChange);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '12.34';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith(12.34);
  });

  it('emits null when the input is cleared', () => {
    const { fixture, host } = setup();
    const onChange = vi.fn();
    host.currency.registerOnChange(onChange);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onTouched on blur', () => {
    const { fixture, host } = setup();
    const onTouched = vi.fn();
    host.currency.registerOnTouched(onTouched);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.dispatchEvent(new Event('blur'));
    expect(onTouched).toHaveBeenCalled();
  });

  it('disables the underlying input via setDisabledState', () => {
    const { fixture, host } = setup();
    host.currency.setDisabledState(true);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.disabled).toBe(true);
  });

  it('uses inputmode="decimal" on the underlying input', () => {
    const { fixture } = setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('uses a text field so the browser cannot drop separators', () => {
    const { fixture } = setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('text');
  });

  it('flags en "1,5" as invalid and emits null instead of 15', () => {
    const { fixture, host } = setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '1,5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.control.value).toBeNull();
    expect(host.control.hasError('numberFormat')).toBe(true);
    expect(input.value).toBe('1,5');
  });

  it('emits null for a partial entry and keeps the typed text', () => {
    const { fixture, host } = setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '-';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.control.value).toBeNull();
    expect(input.value).toBe('-');
  });

  it('does not rewrite the field text when it renders after several keystrokes', () => {
    const { fixture, host } = setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    for (const text of ['4', '41', '412000', '412000.', '412000.0']) {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    expect(input.value).toBe('412000.0');
    input.value = '412000.05';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(input.value).toBe('412000.05');
    expect(host.control.value).toBe(412000.05);
  });

  it('tidies the text on blur without changing the value', () => {
    const { fixture, host } = setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '1,250.50';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.control.value).toBe(1250.5);
    expect(input.value).toBe('1250.50');
  });

  it('reads the comma as the decimal separator in Spanish', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    TestBed.inject(LanguageService).currentLanguage.set('es');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '1,5';
    input.dispatchEvent(new Event('input'));
    expect(host.control.value).toBe(1.5);
    host.control.setValue(42.25);
    fixture.detectChanges();
    expect(input.value).toBe('42,25');
  });
});
