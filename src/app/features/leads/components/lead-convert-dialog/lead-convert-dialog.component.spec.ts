import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

import { LeadConvertDialogComponent, LeadConvertDialogData } from './lead-convert-dialog.component';
import { LeadItem } from '../../models/lead-item.model';
import { ConvertLeadRequest } from '../../models/convert-lead-request.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('LeadConvertDialogComponent', () => {
  let fixture: ComponentFixture<LeadConvertDialogComponent>;
  let component: LeadConvertDialogComponent;
  let closeSpy: Mock;
  let dialogRef: { close: Mock };

  const lead: LeadItem = {
    id: 7,
    companyName: 'Acme Co',
    contactName: 'Jane Smith',
    email: 'jane@acme.test',
    phone: '555-0100',
    source: 'Website',
    status: 'New',
    notes: 'Initial inquiry',
    followUpDate: null,
    lostReason: null,
    convertedCustomerId: null,
    customFieldValues: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as LeadItem;

  beforeEach(async () => {
    closeSpy = vi.fn();
    dialogRef = { close: closeSpy };

    await TestBed.configureTestingModule({
      imports: [
        LeadConvertDialogComponent,
        TranslateModule.forRoot({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { lead } satisfies LeadConvertDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadConvertDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts on step 0 (carry-over preview)', () => {
    expect(component['currentStep']()).toBe(0);
  });

  it('next() advances and back() retreats', () => {
    component['next']();
    expect(component['currentStep']()).toBe(1);
    component['next']();
    expect(component['currentStep']()).toBe(2);
    component['back']();
    expect(component['currentStep']()).toBe(1);
    component['back']();
    component['back']();
    expect(component['currentStep']()).toBe(0);
  });

  it('toggling tax-exempt makes the certificate id required', () => {
    const taxExempt = component['form'].controls.isTaxExempt;
    const certId = component['form'].controls.taxExemptionId;

    expect(certId.hasValidator).toBeTruthy();
    taxExempt.setValue(true);
    expect(certId.invalid).toBe(true); // null + required
    certId.setValue('EX-1');
    expect(certId.valid).toBe(true);

    // Untoggling clears the validator AND the previously typed id (so a
    // half-filled exemption pair doesn't sneak through if the user
    // toggles back-and-forth).
    taxExempt.setValue(false);
    expect(certId.value).toBeNull();
  });

  it('confirm() with empty form sends only createJob — preserves prior minimal-customer behavior', () => {
    component['confirm']();

    expect(closeSpy).toHaveBeenCalled();
    const sent = closeSpy.mock.calls.at(-1)?.[0] as ConvertLeadRequest;
    expect(sent.createJob).toBe(false);
    expect(sent.creditLimit).toBeUndefined();
    expect(sent.billingAddress).toBeUndefined();
    expect(sent.shippingAddress).toBeUndefined();
  });

  it('confirm() forwards rich payload and mirrors billing → shipping when same-as-billing is on', () => {
    const billing = {
      line1: '100 Main', line2: null, city: 'Boston', state: 'MA',
      postalCode: '02108', country: 'US',
    };
    component['form'].patchValue({
      creditLimit: 50_000,
      isTaxExempt: true,
      taxExemptionId: 'EX-1',
      defaultCurrency: 'USD',
      billingAddress: billing,
      shippingSameAsBilling: true,
      createJob: true,
    });

    component['confirm']();

    const sent = closeSpy.mock.calls.at(-1)?.[0] as ConvertLeadRequest;
    expect(sent.createJob).toBe(true);
    expect(sent.creditLimit).toBe(50_000);
    expect(sent.isTaxExempt).toBe(true);
    expect(sent.taxExemptionId).toBe('EX-1');
    expect(sent.billingAddress?.street).toBe('100 Main');
    expect(sent.billingAddress?.postal).toBe('02108');
    // Same-as-billing → shipping mirrors billing rather than being null.
    expect(sent.shippingAddress?.street).toBe('100 Main');
  });

  it('confirm() sends distinct shipping when same-as-billing is off', () => {
    const billing = {
      line1: '100 Main', line2: null, city: 'Boston', state: 'MA',
      postalCode: '02108', country: 'US',
    };
    const shipping = {
      line1: '250 Wharf', line2: 'Suite 4', city: 'Boston', state: 'MA',
      postalCode: '02110', country: 'US',
    };

    component['form'].patchValue({
      billingAddress: billing,
      shippingSameAsBilling: false,
      shippingAddress: shipping,
    });

    component['confirm']();

    const sent = closeSpy.mock.calls.at(-1)?.[0] as ConvertLeadRequest;
    expect(sent.billingAddress?.street).toBe('100 Main');
    expect(sent.shippingAddress?.street).toBe('250 Wharf');
    expect(sent.shippingAddress?.line2).toBe('Suite 4');
  });

  it('close() returns undefined to signal cancel', () => {
    component['close']();
    expect(closeSpy).toHaveBeenCalledWith(undefined);
  });
});
