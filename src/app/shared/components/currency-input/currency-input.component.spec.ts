import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Component, ViewChild } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CurrencyInputComponent } from './currency-input.component';

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
    expect(input.value).toBe('42.5');
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
});
