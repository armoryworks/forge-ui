import { describe, it, expect } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { DecimalInputDirective } from './decimal-input.directive';
import { LanguageService } from '../services/language.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, DecimalInputDirective],
  template: `<input appDecimalInput [formControl]="qty" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly qty = new FormControl<number | null>(0);
}

describe('DecimalInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  async function render(lang: 'en' | 'es'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } })],
    });
    TestBed.inject(LanguageService).currentLanguage.set(lang);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function field(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input') as HTMLInputElement;
  }

  function type(text: string): void {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('renders a text field with a decimal keyboard', async () => {
    await render('en');
    expect(field().type).toBe('text');
    expect(field().getAttribute('inputmode')).toBe('decimal');
    expect(field().value).toBe('0');
  });

  it('reads es "1,5" as 1.5 and shows a stored value with the es decimal comma', async () => {
    await render('es');
    type('1,5');
    expect(host.qty.value).toBe(1.5);
    host.qty.setValue(2.25);
    fixture.detectChanges();
    expect(field().value).toBe('2,25');
  });

  it('flags en "1,5" instead of reading it as 15 and keeps the typed text', async () => {
    await render('en');
    type('1,5');
    expect(host.qty.value).toBeNull();
    expect(host.qty.hasError('numberFormat')).toBe(true);
    expect(field().value).toBe('1,5');
  });

  it('emits null for a cleared field and tidies valid text on blur', async () => {
    await render('en');
    type('');
    expect(host.qty.value).toBeNull();
    expect(host.qty.valid).toBe(true);
    type('1,500.50');
    expect(host.qty.value).toBe(1500.5);
    field().dispatchEvent(new Event('blur'));
    expect(field().value).toBe('1500.5');
    expect(host.qty.touched).toBe(true);
  });
});
