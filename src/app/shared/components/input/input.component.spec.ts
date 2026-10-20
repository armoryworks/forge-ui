import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { InputComponent } from './input.component';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-input-host',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <form [formGroup]="form">
      <app-input label="Minutes" type="number" formControlName="minutes" />
      <button type="submit">Save</button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form = new FormGroup({
    minutes: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
  });
}

describe('InputComponent · field error', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(HostComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function typeAndBlur(value: string): void {
    const inputEl = el.querySelector('input') as HTMLInputElement;
    inputEl.value = value;
    inputEl.dispatchEvent(new Event('input'));
    inputEl.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function errorText(): string | null {
    return el.querySelector('[data-testid="input-error"]')?.textContent?.trim() ?? null;
  }

  function isOutlinedInvalid(): boolean {
    return el.querySelector('mat-form-field')?.classList.contains('mat-form-field-invalid') ?? false;
  }

  it('shows nothing while the control is valid and untouched', () => {
    expect(errorText()).toBeNull();
    expect(isOutlinedInvalid()).toBe(false);
  });

  it('shows the first error with the FormValidationService wording once touched', () => {
    typeAndBlur('-5');
    expect(fixture.componentInstance.form.controls.minutes.value).toBe(-5);
    expect(errorText()).toBe('Minutes must be at least 0');
    expect(isOutlinedInvalid()).toBe(true);
  });

  it('keeps an invalid but untouched control quiet until the form is submitted', () => {
    fixture.componentInstance.form.controls.minutes.setValue(null);
    fixture.detectChanges();
    expect(errorText()).toBeNull();

    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(errorText()).toBe('Minutes is required');
    expect(isOutlinedInvalid()).toBe(true);
  });

  it('clears the message when the value becomes valid again', () => {
    typeAndBlur('-5');
    expect(errorText()).not.toBeNull();
    typeAndBlur('5');
    expect(errorText()).toBeNull();
    expect(isOutlinedInvalid()).toBe(false);
  });

  it('follows a programmatic markAsTouched', () => {
    const control = fixture.componentInstance.form.controls.minutes;
    control.setValue(-1);
    fixture.detectChanges();
    expect(errorText()).toBeNull();
    control.markAsTouched();
    fixture.detectChanges();
    expect(errorText()).toBe('Minutes must be at least 0');
  });
});

@Component({
  selector: 'app-password-host',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `<app-input label="Password" type="password" [formControl]="password" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PasswordHostComponent {
  readonly password = new FormControl('secret');
}

describe('InputComponent · password reveal', () => {
  it('toggles on a click, tap or key press and reports its pressed state', async () => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(PasswordHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector('[data-testid="password-toggle"]') as HTMLButtonElement;
    const input = () => el.querySelector('input') as HTMLInputElement;

    expect(input().type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(input().type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    fixture.detectChanges();
    expect(input().type).toBe('password');
  });
});

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

@Component({
  selector: 'app-number-host',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <app-input label="Quantity" type="number" step="0.0001" min="0" [formControl]="quantity" />
    <app-input label="Price" mask="currency" [formControl]="price" />
    <app-input label="Adjustment" type="number" [formControl]="adjustment" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NumberHostComponent {
  readonly quantity = new FormControl<number | null>(null, Validators.required);
  readonly price = new FormControl<number | null>(null);
  readonly adjustment = new FormControl<number | null>(null);
}

describe('InputComponent · numbers', () => {
  let fixture: ComponentFixture<NumberHostComponent>;
  let host: NumberHostComponent;

  async function render(lang: 'en' | 'es'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    TestBed.inject(LanguageService).currentLanguage.set(lang);
    fixture = TestBed.createComponent(NumberHostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function field(index = 0): HTMLInputElement {
    return fixture.nativeElement.querySelectorAll('input')[index] as HTMLInputElement;
  }

  function type(text: string, index = 0): void {
    field(index).value = text;
    field(index).dispatchEvent(new Event('input'));
  }

  function blur(index = 0): void {
    field(index).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  it('renders a decimal text field instead of a native number input', async () => {
    await render('en');
    expect(field().type).toBe('text');
    expect(field().getAttribute('inputmode')).toBe('decimal');
  });

  it('uses a text keyboard where negative numbers are allowed so the minus key is available', async () => {
    await render('en');
    expect(field(2).type).toBe('text');
    expect(field(2).getAttribute('inputmode')).toBe('text');
    expect(field(1).getAttribute('inputmode')).toBe('decimal');
  });

  it('flags en "1,5" as invalid instead of reading it as 15', async () => {
    await render('en');
    type('1,5');
    fixture.detectChanges();
    expect(host.quantity.value).toBeNull();
    expect(host.quantity.hasError('numberFormat')).toBe(true);
    expect(field().value).toBe('1,5');
  });

  it('reads en "1,500" as 1500 and shows it ungrouped on blur', async () => {
    await render('en');
    type('1,500');
    expect(host.quantity.value).toBe(1500);
    expect(host.quantity.valid).toBe(true);
    blur();
    expect(field().value).toBe('1500');
  });

  it('reads es "1,5" as 1.5, es "1.500" as 1500 and rejects es "1.5"', async () => {
    await render('es');
    type('1,5');
    expect(host.quantity.value).toBe(1.5);
    type('1.500');
    expect(host.quantity.value).toBe(1500);
    type('1.5');
    expect(host.quantity.value).toBeNull();
    expect(host.quantity.hasError('numberFormat')).toBe(true);
  });

  it('shows a stored value with the language decimal separator', async () => {
    await render('es');
    host.quantity.setValue(1234.5);
    fixture.detectChanges();
    expect(field().value).toBe('1234,5');
  });

  it('keeps a typed minus sign and emits -1 rather than 1', async () => {
    await render('en');
    type('-', 2);
    fixture.detectChanges();
    expect(field(2).value).toBe('-');
    expect(host.adjustment.value).toBeNull();
    type('-1', 2);
    fixture.detectChanges();
    expect(field(2).value).toBe('-1');
    expect(host.adjustment.value).toBe(-1);
    expect(host.adjustment.valid).toBe(true);
  });

  it('emits null for a cleared field so a required control is invalid', async () => {
    await render('en');
    host.quantity.setValue(5);
    fixture.detectChanges();
    type('');
    fixture.detectChanges();
    expect(host.quantity.value).toBeNull();
    expect(host.quantity.hasError('required')).toBe(true);
    expect(field().value).toBe('');
  });

  it('does not rewrite the field text when it renders after several keystrokes', async () => {
    await render('en');
    for (const text of ['4', '41', '412', '412000', '412000.', '412000.0']) type(text);
    fixture.detectChanges();
    expect(field().value).toBe('412000.0');
    type('412000.05');
    fixture.detectChanges();
    expect(field().value).toBe('412000.05');
    expect(host.quantity.value).toBe(412000.05);
  });

  it('leaves min, max and step unenforced as they were with the native number input', async () => {
    await render('en');
    type('-1.12345');
    expect(host.quantity.value).toBe(-1.12345);
    expect(host.quantity.valid).toBe(true);
  });

  it('parses the currency mask with the language separators and groups it on blur', async () => {
    await render('es');
    type('1,50', 1);
    expect(host.price.value).toBe(1.5);
    type('12345,67', 1);
    expect(host.price.value).toBe(12345.67);
    blur(1);
    expect(field(1).value).toBe('12.345,67');
    type('1,555', 1);
    expect(host.price.hasError('decimalPlaces')).toBe(true);
  });
});

@Component({
  selector: 'app-mask-host',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <app-input label="Phone" mask="phone" [formControl]="phone" />
    <app-input label="Postal code" mask="zip" [formControl]="zip" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MaskHostComponent {
  readonly phone = new FormControl<string | null>(null);
  readonly zip = new FormControl<string | null>(null);
}

describe('InputComponent · phone and postal code masks', () => {
  let fixture: ComponentFixture<MaskHostComponent>;
  let host: MaskHostComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(MaskHostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function field(index: number): HTMLInputElement {
    return fixture.nativeElement.querySelectorAll('input')[index] as HTMLInputElement;
  }

  function typeAndBlur(index: number, text: string): void {
    field(index).value = text;
    field(index).dispatchEvent(new Event('input'));
    field(index).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function load(control: FormControl<string | null>, value: string, index: number): string {
    control.setValue(value);
    fixture.detectChanges();
    return field(index).value;
  }

  it('keeps a country code and extension instead of truncating to ten digits', () => {
    typeAndBlur(0, '+1 (801) 555-0199 ext 22');
    expect(host.phone.value).toBe('+1 (801) 555-0199 x22');
    expect(field(0).value).toBe('+1 (801) 555-0199 x22');
  });

  it('formats a ten-digit number on blur and leaves the text alone while typing', () => {
    field(0).value = '8015550199';
    field(0).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(field(0).value).toBe('8015550199');
    expect(host.phone.value).toBe('8015550199');
    field(0).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.phone.value).toBe('(801) 555-0199');
  });

  it('keeps an international number, dropping only stray characters', () => {
    typeAndBlur(0, '+44 20 7946 0958!');
    expect(host.phone.value).toBe('+44 20 7946 0958');
  });

  it('shows stored phone numbers it cannot format exactly as saved', () => {
    expect(load(host.phone, '+49 30 1234567', 0)).toBe('+49 30 1234567');
    expect(load(host.phone, 'call reception', 0)).toBe('call reception');
    expect(load(host.phone, '8015550199', 0)).toBe('(801) 555-0199');
  });

  it('leaves a stored phone or postal code unchanged when the field is only focused and left', () => {
    load(host.phone, 'call reception', 0);
    load(host.zip, 'h3b 1a7', 1);
    field(0).dispatchEvent(new Event('blur'));
    field(1).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.phone.value).toBe('call reception');
    expect(host.phone.dirty).toBe(false);
    expect(field(0).value).toBe('call reception');
    expect(host.zip.value).toBe('h3b 1a7');
    expect(host.zip.dirty).toBe(false);
  });

  it('keeps a Canadian postal code and uppercases it', () => {
    typeAndBlur(1, 'h3b 1a7');
    expect(host.zip.value).toBe('H3B 1A7');
    expect(load(host.zip, 'SW1A 1AA', 1)).toBe('SW1A 1AA');
  });

  it('still formats US ZIP and ZIP+4 codes', () => {
    typeAndBlur(1, '841011234');
    expect(host.zip.value).toBe('84101-1234');
    expect(load(host.zip, '84101', 1)).toBe('84101');
  });

  it('caps phone and postal code at the API lengths', () => {
    expect(field(0).getAttribute('maxlength')).toBe('50');
    expect(field(1).getAttribute('maxlength')).toBe('20');
  });
});

@Component({
  selector: 'app-input-counter-host',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `<app-input label="Code" [maxlength]="10" [formControl]="code" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CounterHostComponent {
  readonly code = new FormControl<string>('');
}

describe('InputComponent · character counter', () => {
  it('appears only once the value nears the max length', async () => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(CounterHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const counter = () => el.querySelector('[data-testid="input-counter"]')?.textContent?.trim() ?? null;
    const inputEl = el.querySelector('input') as HTMLInputElement;

    inputEl.value = 'abcde';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(counter()).toBeNull();

    inputEl.value = 'abcdefgh';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(counter()).toBe('8 / 10');
  });
});
