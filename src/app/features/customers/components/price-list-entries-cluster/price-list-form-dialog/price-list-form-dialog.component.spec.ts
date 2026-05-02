import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { environment } from '../../../../../../environments/environment';
import {
  PriceListFormDialogComponent,
  PriceListFormDialogData,
} from './price-list-form-dialog.component';
import { PriceList } from '../../../models/price-list.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface FormDialogInternals {
  form: {
    invalid: boolean;
    dirty: boolean;
    patchValue(v: unknown): void;
    markAsDirty(): void;
    get(name: string): { setValue(v: unknown): void } | null;
  };
  save(): void;
  isEdit: boolean;
}

function setup(data?: Partial<PriceListFormDialogData>) {
  const dialogData: PriceListFormDialogData = {
    priceList: null,
    customerId: 50,
    ...data,
  };
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<PriceListFormDialogComponent, PriceList | null>;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  // Construct imperatively without rendering — same pattern used by the
  // sibling `price-list-entry-form-dialog` spec.
  const component = TestBed.runInInjectionContext(() => new PriceListFormDialogComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  return { component: component as unknown as FormDialogInternals, dialogRef, httpMock };
}

describe('PriceListFormDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders an empty form in create mode (Name required)', () => {
    const { component } = setup();
    expect(component.isEdit).toBe(false);
    // Name is required; without it the form is invalid.
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ name: 'Q1 2026 Negotiated' });
    expect(component.form.invalid).toBe(false);
  });

  it('renders pre-filled values in edit mode', () => {
    const existing: PriceList = {
      id: 7,
      name: 'Existing List',
      description: 'Notes',
      customerId: 50,
      isDefault: true,
      isActive: true,
      effectiveFrom: null,
      effectiveTo: null,
    };
    const { component } = setup({ priceList: existing });
    expect(component.isEdit).toBe(true);
    // Pre-filled with valid Name → form is valid out of the box.
    expect(component.form.invalid).toBe(false);
  });

  it('flags a violation when EffectiveTo is not after EffectiveFrom', () => {
    const { component } = setup();
    const from = new Date('2026-06-01');
    const to = new Date('2026-05-01'); // before From → invalid
    component.form.patchValue({
      name: 'Range Test',
      effectiveFrom: from,
      effectiveTo: to,
    });
    expect(component.form.invalid).toBe(true);

    // Fix it — flip the dates.
    component.form.patchValue({
      effectiveFrom: to,
      effectiveTo: from,
    });
    expect(component.form.invalid).toBe(false);
  });

  it('save() POSTs to /price-lists and closes the dialog with the saved list', () => {
    const { component, dialogRef, httpMock } = setup({ customerId: 99 });
    component.form.patchValue({ name: 'Q2 Volume Tier' });

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/price-lists`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      name: 'Q2 Volume Tier',
      customerId: 99,
      isActive: true,
    });

    const result: PriceList = {
      id: 200,
      name: 'Q2 Volume Tier',
      description: null,
      customerId: 99,
      isDefault: false,
      isActive: true,
      effectiveFrom: null,
      effectiveTo: null,
    };
    req.flush(result);

    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 200 }));
    httpMock.verify();
  });

  it('on edit, save() PUTs to /price-lists/{id} with no customerId', () => {
    const existing: PriceList = {
      id: 11, name: 'Old Name', description: null, customerId: 50,
      isDefault: false, isActive: true,
      effectiveFrom: null, effectiveTo: null,
    };
    const { component, dialogRef, httpMock } = setup({ priceList: existing });
    component.form.patchValue({ name: 'New Name' });

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/price-lists/11`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ name: 'New Name', isDefault: false, isActive: true });
    // CustomerId is fixed at creation time — must not appear on update.
    expect(req.request.body).not.toHaveProperty('customerId');

    req.flush({ ...existing, name: 'New Name' });
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
    httpMock.verify();
  });
});
