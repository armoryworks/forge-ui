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
  PriceListEntryBulkImportDialogComponent,
  PriceListEntryBulkImportDialogData,
} from './price-list-entry-bulk-import-dialog.component';
import {
  BulkImportPreviewResponse,
  BulkImportResultResponse,
} from '../../../models/price-list-bulk-import.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  inPreviewState(): boolean;
  canApply(): boolean;
  preview(): BulkImportPreviewResponse | null;
  selectedFile(): File | null;
  ['selectFile'](file: File): void;   // private method exercised via bracket access
  apply(): void;
  applying(): boolean;
}

function setup() {
  const dialogData: PriceListEntryBulkImportDialogData = {
    priceListId: 200,
    priceListName: 'Standard',
  };
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<
    PriceListEntryBulkImportDialogComponent, BulkImportResultResponse | null>;

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

  // Imperative construction (same pattern as the form-dialog spec) — avoids
  // rendering and the Material/CDK overlay scaffolding that comes with it.
  const component = TestBed.runInInjectionContext(
    () => new PriceListEntryBulkImportDialogComponent(),
  );
  const httpMock = TestBed.inject(HttpTestingController);
  return { component: component as unknown as DialogInternals, dialogRef, httpMock };
}

describe('PriceListEntryBulkImportDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts in file-picker state with no preview loaded', () => {
    const { component } = setup();
    expect(component.inPreviewState()).toBe(false);
    expect(component.preview()).toBeNull();
    expect(component.canApply()).toBe(false);
  });

  it('selecting a file POSTs to import-preview and transitions to preview state', () => {
    const { component, httpMock } = setup();

    const file = new File(
      ['partNumber,unitPrice\nPART-001,5.00\n'],
      'import.csv',
      { type: 'text/csv' },
    );
    component['selectFile'](file);

    const req = httpMock.expectOne(
      `${environment.apiUrl}/price-lists/200/entries/import-preview`,
    );
    expect(req.request.method).toBe('POST');

    const previewBody: BulkImportPreviewResponse = {
      totalRows: 1,
      addCount: 1,
      updateCount: 0,
      errorCount: 0,
      rows: [{
        lineNumber: 2, partNumber: 'PART-001', partName: 'Widget', partId: 7,
        unitPrice: 5.00, minQuantity: 1, currency: 'USD', notes: null,
        action: 'Add', errorMessage: null,
      }],
    };
    req.flush(previewBody);

    expect(component.inPreviewState()).toBe(true);
    expect(component.preview()?.addCount).toBe(1);
    expect(component.canApply()).toBe(true);
    httpMock.verify();
  });

  it('canApply() is false when the preview reports any error rows', () => {
    const { component, httpMock } = setup();
    const file = new File(['partNumber,unitPrice\nBAD,oops\n'], 'bad.csv', { type: 'text/csv' });
    component['selectFile'](file);

    const req = httpMock.expectOne(
      `${environment.apiUrl}/price-lists/200/entries/import-preview`,
    );
    req.flush({
      totalRows: 1, addCount: 0, updateCount: 0, errorCount: 1,
      rows: [{
        lineNumber: 2, partNumber: 'BAD', partName: null, partId: null,
        unitPrice: null, minQuantity: 1, currency: 'USD', notes: null,
        action: 'Error', errorMessage: 'unitPrice is required and must be a number',
      }],
    } satisfies BulkImportPreviewResponse);

    expect(component.inPreviewState()).toBe(true);
    expect(component.preview()?.errorCount).toBe(1);
    expect(component.canApply()).toBe(false);
    httpMock.verify();
  });

  it('apply() POSTs to import-apply and closes the dialog with the result', () => {
    const { component, dialogRef, httpMock } = setup();
    const file = new File(['partNumber,unitPrice\nPART-001,5.00\n'], 'import.csv', { type: 'text/csv' });
    component['selectFile'](file);

    httpMock.expectOne(
      `${environment.apiUrl}/price-lists/200/entries/import-preview`,
    ).flush({
      totalRows: 1, addCount: 1, updateCount: 0, errorCount: 0,
      rows: [{
        lineNumber: 2, partNumber: 'PART-001', partName: 'Widget', partId: 7,
        unitPrice: 5.00, minQuantity: 1, currency: 'USD', notes: null,
        action: 'Add', errorMessage: null,
      }],
    } satisfies BulkImportPreviewResponse);

    component.apply();

    const applyReq = httpMock.expectOne(
      `${environment.apiUrl}/price-lists/200/entries/import-apply`,
    );
    expect(applyReq.request.method).toBe('POST');

    const result: BulkImportResultResponse = {
      addedCount: 1, updatedCount: 0, skippedCount: 0, errorCount: 0,
      rows: [{ lineNumber: 2, action: 'Add', createdOrUpdatedEntryId: 999, errorMessage: null }],
    };
    applyReq.flush(result);

    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ addedCount: 1 }));
    httpMock.verify();
  });
});
