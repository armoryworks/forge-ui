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
  VendorPartFormDialogComponent,
  VendorPartFormDialogData,
} from './vendor-part-form-dialog.component';
import { VendorPart } from '../../models/vendor-part.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface FormDialogInternals {
  form: {
    invalid: boolean;
    controls: Record<string, { value: unknown; setValue(v: unknown): void }>;
    patchValue(v: unknown): void;
  };
  save(): void;
  close(): void;
  isEdit: boolean;
  showVendorPicker: boolean;
}

function setupCreate(data?: Partial<VendorPartFormDialogData>) {
  const dialogData: VendorPartFormDialogData = {
    vendorPart: null,
    parentEntityType: 'part',
    parentEntityId: 42,
    parentLabel: 'PRT-42 — Widget',
    ...data,
  };
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<VendorPartFormDialogComponent, VendorPart | null>;

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

  // Construct the component imperatively without rendering its template
  // (its template uses `<app-validation-button>` whose required `violations`
  // input is satisfied at construction time, but creating the component via
  // TestBed.createComponent triggers eager template rendering and shared
  // children, which is brittle in this Vitest harness).
  const component = TestBed.runInInjectionContext(() => new VendorPartFormDialogComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  return { component: component as unknown as FormDialogInternals, dialogRef, httpMock };
}

describe('VendorPartFormDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('is invalid on create (parent=part) until the vendor has been picked', () => {
    const { component } = setupCreate();
    expect(component.isEdit).toBe(false);
    expect(component.showVendorPicker).toBe(true);
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ vendorId: 7 });
    expect(component.form.invalid).toBe(false);
  });

  it('save() POSTs to /vendor-parts and closes the dialog with the saved entity', () => {
    const { component, dialogRef, httpMock } = setupCreate();
    component.form.patchValue({ vendorId: 7 });

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/vendor-parts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ vendorId: 7, partId: 42 });

    const result: Partial<VendorPart> = {
      id: 999, vendorId: 7, partId: 42, vendorCompanyName: 'New Vendor',
      partNumber: 'PRT-42', partName: 'Widget',
      isApproved: true, isPreferred: false, priceTiers: [],
    };
    req.flush(result);

    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 999 }));
    httpMock.verify();
  });
});
