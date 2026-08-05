import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { provideAnimations } from '@angular/platform-browser/animations';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { EstimateLine, EstimateLineResolution } from '../../models/estimate.model';
import {
  EstimateLumpSumResolveDialogComponent,
  EstimateLumpSumResolveDialogData,
} from './estimate-lump-sum-resolve-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

/** Mirror of the per-line resolution FormGroup's controls. */
interface ResolutionControls {
  action: FormControl<'Keep' | 'Eliminate' | 'ReplaceWithPart' | null>;
  partId: FormControl<number | null>;
  unitPrice: FormControl<number | null>;
}

/** Protected members exercised by the #24 resolution-payload tests. */
interface DialogInternals {
  resolutions: FormArray<FormGroup<ResolutionControls>>;
  form: FormGroup;
  violations(): string[];
  confirm(): void;
  close(): void;
  onPartSelected(index: number, part: Record<string, unknown> | null): void;
}

function makeLine(overrides: Partial<EstimateLine> = {}): EstimateLine {
  return {
    id: 1,
    partId: null,
    partNumber: null,
    description: 'Lump-sum line',
    quantity: 1,
    unitPrice: 100,
    lineTotal: 100,
    lineNumber: 1,
    notes: null,
    ...overrides,
  };
}

function setup(data: Partial<EstimateLumpSumResolveDialogData> = {}) {
  TestBed.resetTestingModule();
  const dialogRef = { close: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          customerId: 9,
          estimateTitle: 'Tooling estimate',
          lumpSumLines: [makeLine()],
          otherLineCount: 0,
          ...data,
        } satisfies EstimateLumpSumResolveDialogData,
      },
    ],
  });

  // Construct imperatively without rendering — same pattern as the
  // quote-dialog spec.
  const component = TestBed.runInInjectionContext(() => new EstimateLumpSumResolveDialogComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  return { component, internals: component as unknown as DialogInternals, httpMock, dialogRef };
}

describe('EstimateLumpSumResolveDialogComponent — #24 lump-sum resolution', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('produces the correct resolutions payload for eliminate + replace choices', () => {
    const lines = [
      makeLine({ id: 11, description: 'Drop me', unitPrice: 250 }),
      makeLine({ id: 12, description: 'Replace me', lineNumber: 2, unitPrice: 40 }),
    ];
    const { internals, dialogRef } = setup({ lumpSumLines: lines, otherLineCount: 1 });

    internals.resolutions.at(0).controls.action.setValue('Eliminate');
    internals.resolutions.at(1).controls.action.setValue('ReplaceWithPart');
    internals.resolutions.at(1).controls.partId.setValue(77);
    internals.resolutions.at(1).controls.unitPrice.setValue(42.5);

    internals.confirm();

    expect(dialogRef.close).toHaveBeenCalledWith([
      { estimateLineId: 11, action: 'Eliminate' },
      { estimateLineId: 12, action: 'ReplaceWithPart', partId: 77, unitPrice: 42.5 },
    ] satisfies EstimateLineResolution[]);
  });

  it('blocks confirm until every line has a decision', () => {
    const { internals, dialogRef } = setup({ otherLineCount: 1 });

    expect(internals.form.invalid).toBe(true);
    expect(internals.violations().length).toBe(1);
    internals.confirm();
    expect(dialogRef.close).not.toHaveBeenCalled();

    internals.resolutions.at(0).controls.action.setValue('Eliminate');
    expect(internals.form.valid).toBe(true);
  });

  it('requires a part when replacing', () => {
    const { internals, dialogRef } = setup();

    internals.resolutions.at(0).controls.action.setValue('ReplaceWithPart');
    expect(internals.form.invalid).toBe(true);
    expect(internals.violations().length).toBe(1);
    internals.confirm();
    expect(dialogRef.close).not.toHaveBeenCalled();

    internals.resolutions.at(0).controls.partId.setValue(5);
    expect(internals.form.valid).toBe(true);
  });

  it('rejects eliminating every line when no catalog-part lines remain', () => {
    const { internals } = setup({ otherLineCount: 0 });

    internals.resolutions.at(0).controls.action.setValue('Eliminate');

    expect(internals.form.invalid).toBe(true);
    expect(internals.violations().length).toBe(1);
  });

  it('allows eliminating every lump-sum line when catalog-part lines remain', () => {
    const { internals } = setup({ otherLineCount: 2 });

    internals.resolutions.at(0).controls.action.setValue('Eliminate');

    expect(internals.form.valid).toBe(true);
  });

  it('prefills the unit price from the customer price resolver on part select', () => {
    const { internals, httpMock } = setup();

    internals.resolutions.at(0).controls.action.setValue('ReplaceWithPart');
    internals.onPartSelected(0, { id: 7, name: 'Bracket' });

    httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/quotes/resolve-price`
      && r.params.get('customerId') === '9'
      && r.params.get('partId') === '7',
    ).flush(12.34);

    expect(internals.resolutions.at(0).controls.unitPrice.value).toBe(12.34);
    httpMock.verify();
  });

  it('keeps the lump-sum amount when the resolver has no price', () => {
    const { internals, httpMock } = setup();

    internals.onPartSelected(0, { id: 7 });
    httpMock.expectOne(r => r.url === `${environment.apiUrl}/quotes/resolve-price`).flush(null);

    expect(internals.resolutions.at(0).controls.unitPrice.value).toBe(100);
    httpMock.verify();
  });

  it('resolves null on cancel so the caller aborts the convert', () => {
    const { internals, dialogRef } = setup();

    internals.close();

    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });
});
