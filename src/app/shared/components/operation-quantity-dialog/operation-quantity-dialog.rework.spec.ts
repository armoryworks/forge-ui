import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { OperationQuantityDialogComponent } from './operation-quantity-dialog.component';
import { OperationQuantityDialogData } from '../../models/operation-quantity-dialog-data.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  form: { patchValue(value: { quantity?: number | null; rework?: number | null }): void };
  offerReworkTime: () => boolean;
  chooseReworkTime(book: boolean): void;
  record(): void;
}

function setup(data: Partial<OperationQuantityDialogData>) {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: { title: 'Grind', jobQuantity: 40, completedQuantity: 10, scrapQuantity: 0, reasons: [], ...data } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new OperationQuantityDialogComponent()) as unknown as DialogInternals;
  return { component, close };
}

describe('OperationQuantityDialogComponent · rework time', () => {
  it('offers to book rework time when rework is recorded while a Run timer is open, and books it by default', () => {
    const { component, close } = setup({ runTimerOpen: true });

    component.form.patchValue({ quantity: 0, rework: 3 });
    expect(component.offerReworkTime()).toBe(true);
    component.record();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ reworkQuantity: 3, bookReworkTime: true }));
  });

  it('leaves the timers alone when the operator is already on a rework timer', () => {
    const { component, close } = setup({ runTimerOpen: true });

    component.form.patchValue({ quantity: 0, rework: 2 });
    component.chooseReworkTime(false);
    component.record();

    expect(close.mock.calls[0][0].bookReworkTime).toBeUndefined();
  });

  it('makes no offer without rework pieces or without an open Run timer', () => {
    const noRework = setup({ runTimerOpen: true }).component;
    noRework.form.patchValue({ quantity: 4, rework: 0 });
    expect(noRework.offerReworkTime()).toBe(false);

    const noTimer = setup({}).component;
    noTimer.form.patchValue({ quantity: 0, rework: 2 });
    expect(noTimer.offerReworkTime()).toBe(false);
  });
});
