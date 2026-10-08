import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AddressFormComponent } from './address-form.component';
import { AutocompleteComponent, AutocompleteOption } from '../autocomplete/autocomplete.component';
import { AddressService } from '../../services/address.service';
import { Address } from '../../models/address.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

@Component({
  selector: 'app-address-form-host',
  standalone: true,
  imports: [ReactiveFormsModule, AddressFormComponent],
  template: '<app-address-form [formControl]="address" [showVerify]="false" [requireState]="requireState" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  requireState = true;
  readonly address = new FormControl<Address | null>({
    line1: '1 Main St',
    city: 'Salt Lake City',
    state: 'UT',
    postalCode: '84101',
    country: 'US',
  });
}

@Component({
  selector: 'app-address-form-group-host',
  standalone: true,
  imports: [ReactiveFormsModule, AddressFormComponent],
  template: `
    <form [formGroup]="form">
      <app-address-form formControlName="address" [showVerify]="false" />
      <button type="submit">Save</button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class GroupHostComponent {
  readonly form = new FormGroup({
    address: new FormControl<Address | null>(null),
  });
}

function configure(): void {
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: AddressService, useValue: { validate: () => of({ isValid: true, messages: [] }) } },
    ],
  });
}

interface StatePicker {
  searchControl: { setValue(value: string): void };
  filteredOptions(): AutocompleteOption[];
  onOptionSelected(event: { option: { value: AutocompleteOption | undefined } }): void;
}

describe('AddressFormComponent · state picker', () => {
  let fixture: ComponentFixture<HostComponent>;
  let picker: StatePicker;
  let stateInput: HTMLInputElement;

  async function render(requireState: boolean): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.requireState = requireState;
    await fixture.whenStable();
    fixture.detectChanges();
    const pickerDe = fixture.debugElement.query(By.directive(AutocompleteComponent));
    picker = pickerDe.componentInstance as unknown as StatePicker;
    stateInput = pickerDe.nativeElement.querySelector('input');
  }

  beforeEach(async () => {
    configure();
    await render(true);
  });

  async function typeAndBlur(text: string): Promise<void> {
    stateInput.value = text;
    stateInput.dispatchEvent(new Event('input'));
    stateInput.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function labels(options: AutocompleteOption[]): string[] {
    return options.map(o => String(o['label']));
  }

  it('shows the stored code as code and name', () => {
    expect(stateInput.value).toBe('UT - Utah');
  });

  it('finds a state by its name', () => {
    picker.searchControl.setValue('Utah');
    expect(labels(picker.filteredOptions())).toEqual(['UT - Utah']);
  });

  it('finds a state by its code', () => {
    picker.searchControl.setValue('NY');
    expect(labels(picker.filteredOptions())).toEqual(['NY - New York']);
  });

  it('lists every state before anything is typed', () => {
    picker.searchControl.setValue('');
    expect(picker.filteredOptions().length).toBe(51);
  });

  it('stores the two-letter code when a state is picked', () => {
    const option = picker.filteredOptions().find(o => o['value'] === 'NV');
    picker.onOptionSelected({ option: { value: option } });
    expect(fixture.componentInstance.address.value?.state).toBe('NV');
  });

  it('keeps a typed code that was not picked from the list', async () => {
    await typeAndBlur('ut');
    expect(fixture.componentInstance.address.value?.state).toBe('UT');
    expect(stateInput.value).toBe('UT - Utah');
  });

  it('keeps a typed full name that was not picked from the list', async () => {
    await typeAndBlur('Utah');
    expect(fixture.componentInstance.address.value?.state).toBe('UT');
  });

  it('stores a typed code on blur while its option list is still open', async () => {
    const trigger = fixture.debugElement.query(By.directive(MatAutocompleteTrigger)).injector.get(MatAutocompleteTrigger);
    stateInput.value = 'PA';
    stateInput.dispatchEvent(new Event('input'));
    trigger.openPanel();
    fixture.detectChanges();
    expect(trigger.panelOpen).toBe(true);
    stateInput.dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.address.value?.state).toBe('PA');
  });

  it('prefers an exact name over a partial match', async () => {
    await typeAndBlur('virginia');
    expect(fixture.componentInstance.address.value?.state).toBe('VA');
  });

  it('clears unmatched text instead of leaving it over an empty value', async () => {
    await typeAndBlur('zz');
    expect(fixture.componentInstance.address.value?.state).toBe('');
    expect(stateInput.value).toBe('');
  });

  it('keeps the stored state on an optional address when its code is retyped', async () => {
    await render(false);
    await typeAndBlur('UT');
    expect(fixture.componentInstance.address.value?.state).toBe('UT');
  });

  it('marks the state field required only when requireState is set', async () => {
    expect(stateInput.required).toBe(true);
    await render(false);
    expect(stateInput.required).toBe(false);
  });
});

describe('AddressFormComponent · errors from the outer form', () => {
  let fixture: ComponentFixture<GroupHostComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    configure();
    fixture = TestBed.createComponent(GroupHostComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function errorCount(): number {
    return el.querySelectorAll('[data-testid="input-error"]').length;
  }

  it('shows nothing before the outer form is touched or submitted', () => {
    expect(errorCount()).toBe(0);
  });

  it('shows the inner required errors when the outer form is submitted', () => {
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(errorCount()).toBe(3);
  });

  it('shows the inner required errors when the outer form is marked touched', () => {
    fixture.componentInstance.form.markAllAsTouched();
    fixture.detectChanges();
    expect(errorCount()).toBe(3);
  });

  it('does not flag untouched fields while the user types in one of them', () => {
    const line1 = el.querySelector('app-input input') as HTMLInputElement;
    line1.value = '1 Main St';
    line1.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(errorCount()).toBe(0);
  });
});
