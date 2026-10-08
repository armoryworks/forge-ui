import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { InputComponent } from './input.component';

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
