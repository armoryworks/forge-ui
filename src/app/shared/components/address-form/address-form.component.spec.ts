import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
  template: '<app-address-form [formControl]="address" [showVerify]="false" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly address = new FormControl<Address | null>({
    line1: '1 Main St',
    city: 'Salt Lake City',
    state: 'UT',
    postalCode: '84101',
    country: 'US',
  });
}

describe('AddressFormComponent · state picker', () => {
  let fixture: ComponentFixture<HostComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let picker: any;
  let stateInput: HTMLInputElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: AddressService, useValue: { validate: () => of({ isValid: true, messages: [] }) } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const pickerDe = fixture.debugElement.query(By.directive(AutocompleteComponent));
    picker = pickerDe.componentInstance;
    stateInput = pickerDe.nativeElement.querySelector('input');
  });

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
    const option = picker.filteredOptions().find((o: AutocompleteOption) => o['value'] === 'NV');
    picker.onOptionSelected({ option: { value: option } });
    expect(fixture.componentInstance.address.value?.state).toBe('NV');
  });
});
