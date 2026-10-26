import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DepreciationPreview } from '../../models/depreciation-preview.model';
import { DepreciationRunResult } from '../../models/depreciation-run-result.model';
import { DepreciationRunDialogComponent } from './depreciation-run-dialog.component';

type Internals = {
  monthControl: FormControl<Date | null>;
  preview(): DepreciationPreview | null;
  result(): DepreciationRunResult | null;
  canPost(): boolean;
  runPreview(): void;
  post(): void;
  close(): void;
};

const api = `${environment.apiUrl}/accounting/depreciation`;
const PREVIEW: DepreciationPreview = {
  bookId: 1, periodMonth: '2026-03-01', totalAmount: 250,
  lines: [
    { fixedAssetId: 1, name: 'CNC Mill', assetTag: 'FA-001', amount: 100, netBookValueAfter: 800 },
    { fixedAssetId: 2, name: 'Press', assetTag: null, amount: 150, netBookValueAfter: 4850 },
  ],
};

describe('DepreciationRunDialogComponent', () => {
  let http: HttpTestingController;
  const dialogRef = { close: vi.fn() };

  function create(): Internals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { bookId: 1 } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(DepreciationRunDialogComponent, { set: { template: '', imports: [] } });
    http = TestBed.inject(HttpTestingController);
    const c = TestBed.createComponent(DepreciationRunDialogComponent).componentInstance as unknown as Internals;
    c.monthControl.setValue(new Date(2026, 2, 17));
    return c;
  }

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => http.verify());

  it('previews the first of the chosen month before anything can post', () => {
    const c = create();
    expect(c.canPost()).toBe(false);

    c.runPreview();

    const req = http.expectOne(`${api}/preview`);
    expect(req.request.body).toEqual({ bookId: 1, periodMonth: '2026-03-01' });
    req.flush(PREVIEW);
    expect(c.preview()?.totalAmount).toBe(250);
    expect(c.canPost()).toBe(true);
  });

  it('posts the previewed month and closes reporting that entries posted', () => {
    const c = create();
    c.runPreview();
    http.expectOne(`${api}/preview`).flush(PREVIEW);

    c.post();

    const req = http.expectOne(`${api}/run`);
    expect(req.request.body).toEqual({ bookId: 1, periodMonth: '2026-03-01' });
    req.flush({ bookId: 1, periodMonth: '2026-03-01', assetsDepreciated: 2, totalAmount: 250, journalEntryIds: [41, 42] });
    expect(c.result()?.journalEntryIds).toEqual([41, 42]);
    expect(c.canPost()).toBe(false);

    c.close();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('will not post an empty preview', () => {
    const c = create();
    c.runPreview();
    http.expectOne(`${api}/preview`).flush({ ...PREVIEW, lines: [], totalAmount: 0 });

    c.post();

    http.expectNone(`${api}/run`);
  });

  it('drops the preview when the month changes', () => {
    const c = create();
    c.runPreview();
    http.expectOne(`${api}/preview`).flush(PREVIEW);

    c.monthControl.setValue(new Date(2026, 3, 1));

    expect(c.preview()).toBeNull();
    c.close();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
