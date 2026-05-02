import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { environment } from '../../../../../environments/environment';
import {
  PriceListEntryFormDialogComponent,
  PriceListEntryFormDialogData,
} from './price-list-entry-form-dialog.component';
import { PriceListEntry } from '../../models/price-list.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface FormDialogInternals {
  form: {
    invalid: boolean;
    patchValue(v: unknown): void;
  };
  save(): void;
  isEdit: boolean;
}

function setup(data?: Partial<PriceListEntryFormDialogData>) {
  const dialogData: PriceListEntryFormDialogData = {
    entry: null,
    priceListId: 100,
    ...data,
  };
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<PriceListEntryFormDialogComponent, PriceListEntry | null>;

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
  // vendor-part form dialog spec (see component header for rationale).
  const component = TestBed.runInInjectionContext(() => new PriceListEntryFormDialogComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  return { component: component as unknown as FormDialogInternals, dialogRef, httpMock };
}

describe('PriceListEntryFormDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('is invalid on create until part + unitPrice are picked', () => {
    const { component } = setup();
    expect(component.isEdit).toBe(false);
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ partId: 7, unitPrice: 12.5 });
    expect(component.form.invalid).toBe(false);
  });

  it('save() POSTs to /price-lists/{id}/entries and closes the dialog with the saved row', () => {
    const { component, dialogRef, httpMock } = setup();
    component.form.patchValue({ partId: 42, unitPrice: 9.99, minQuantity: 100, currency: 'USD' });

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/price-lists/100/entries`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      partId: 42, unitPrice: 9.99, minQuantity: 100, currency: 'USD',
    });

    const result: PriceListEntry = {
      id: 999, priceListId: 100, partId: 42,
      partNumber: 'X-42', partName: 'Test',
      unitPrice: 9.99, minQuantity: 100, currency: 'USD', notes: null,
      createdAt: '2026-04-30T00:00:00Z', updatedAt: '2026-04-30T00:00:00Z',
    };
    req.flush(result);

    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 999 }));
    httpMock.verify();
  });

  it('on edit, save() PUTs to /price-list-entries/{id} and locks PartId', () => {
    const existing: PriceListEntry = {
      id: 5, priceListId: 100, partId: 42,
      partNumber: 'X-42', partName: 'Test',
      unitPrice: 10, minQuantity: 1, currency: 'USD', notes: null,
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    };
    const { component, dialogRef, httpMock } = setup({ entry: existing });
    expect(component.isEdit).toBe(true);

    component.form.patchValue({ unitPrice: 11.5, notes: 'Negotiated' });
    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/price-list-entries/5`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ unitPrice: 11.5, notes: 'Negotiated' });
    // PartId must NOT appear on the update body — entry id is keyed off
    // (PriceListId, PartId, MinQuantity).
    expect(req.request.body).not.toHaveProperty('partId');

    req.flush({ ...existing, unitPrice: 11.5, notes: 'Negotiated' });
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 11.5 }));
    httpMock.verify();
  });
});
