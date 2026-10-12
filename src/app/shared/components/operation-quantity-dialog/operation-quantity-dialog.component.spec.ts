import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { OperationQuantityDialogComponent } from './operation-quantity-dialog.component';
import { OperationQuantityDialogData } from '../../models/operation-quantity-dialog-data.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  remaining: number;
  form: { patchValue(value: { quantity?: number | null; scrap?: number | null; rework?: number | null; reason?: string | null }): void };
  askReason: () => boolean;
  violations: () => string[];
  canRecord: () => boolean;
  isAll: () => boolean;
  record(): void;
  complete(): void;
}

function setup(data: OperationQuantityDialogData) {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new OperationQuantityDialogComponent()) as unknown as DialogInternals;
  return { component, close };
}

describe('OperationQuantityDialogComponent', () => {
  it('prefills the pieces still to do and completes all of them', () => {
    const { component, close } = setup({ title: 'Mill', jobQuantity: 40, completedQuantity: 12, scrapQuantity: 2, reasons: [] });

    expect(component.remaining).toBe(26);
    expect(component.isAll()).toBe(true);
    component.complete();

    expect(close).toHaveBeenCalledWith({ completedQuantity: 38, scrapQuantity: 2, reworkQuantity: 0, reasonCode: null, complete: true });
  });

  it('records a partial count as absolute totals and keeps the step open', () => {
    const { component, close } = setup({ title: 'Mill', jobQuantity: 40, completedQuantity: 12, scrapQuantity: 0, reasons: [] });

    component.form.patchValue({ quantity: 8, scrap: 1 });
    expect(component.isAll()).toBe(false);
    component.record();

    expect(close).toHaveBeenCalledWith({ completedQuantity: 20, scrapQuantity: 1, reworkQuantity: 0, reasonCode: null, complete: false });
  });

  it('warns and refuses when finished plus scrapped exceeds the job quantity', () => {
    const { component, close } = setup({ title: 'Mill', jobQuantity: 10, completedQuantity: 8, scrapQuantity: 0, reasons: [] });

    component.form.patchValue({ quantity: 3 });
    expect(component.violations()).toHaveLength(1);
    expect(component.canRecord()).toBe(false);
    component.record();
    component.complete();

    expect(close).not.toHaveBeenCalled();
  });

  it('asks for a reason once scrap or rework is entered and returns both', () => {
    const { component, close } = setup({
      title: 'Mill', jobQuantity: 40, completedQuantity: 12, scrapQuantity: 0,
      reasons: [{ code: 'tooling', label: 'Tool wear' }],
    });

    expect(component.askReason()).toBe(false);
    component.form.patchValue({ quantity: 0, rework: 3, reason: 'tooling' });
    expect(component.askReason()).toBe(true);
    expect(component.canRecord()).toBe(true);
    component.record();

    expect(close).toHaveBeenCalledWith({
      completedQuantity: 12, scrapQuantity: 0, reworkQuantity: 3, reasonCode: 'tooling', complete: false,
    });
  });

  it('drops a stale reason when nothing is scrapped or reworked', () => {
    const { component, close } = setup({
      title: 'Mill', jobQuantity: 40, completedQuantity: 12, scrapQuantity: 0,
      reasons: [{ code: 'tooling', label: 'Tool wear' }],
    });

    component.form.patchValue({ quantity: 5, rework: 0, reason: 'tooling' });
    component.record();

    expect(close).toHaveBeenCalledWith({
      completedQuantity: 17, scrapQuantity: 0, reworkQuantity: 0, reasonCode: null, complete: false,
    });
  });
});
