import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractService } from '../../services/subcontract.service';
import { SubcontractReceiveBackDialogComponent } from './subcontract-receive-back-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const order = { id: 5, quantity: 10, vendorName: 'Plating Co', operationName: 'Anodize', status: 'Sent' } as SubcontractOrder;

function setup() {
  const close = vi.fn();
  const receiveBack = vi.fn(() => of({ ...order, status: 'Complete' } as SubcontractOrder));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: { order } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: SubcontractService, useValue: { receiveBack } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new SubcontractReceiveBackDialogComponent());
  return { component, receiveBack, close };
}

describe('SubcontractReceiveBackDialogComponent', () => {
  it('defaults the good quantity to what was sent', () => {
    const { component } = setup();
    expect(component.formGroup.controls.goodQuantity.value).toBe(10);
    expect(component.formGroup.controls.scrapQuantity.value).toBe(0);
  });

  it('receives good and scrap back as passed', () => {
    const { component, receiveBack, close } = setup();
    component.formGroup.controls.goodQuantity.setValue(8);
    component.formGroup.controls.scrapQuantity.setValue(2);

    component.save();

    expect(receiveBack).toHaveBeenCalledWith(5, { receivedQuantity: 8, scrapQuantity: 2, passedInspection: true });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ status: 'Complete' }));
  });

  it('marks an all-scrap return as failed', () => {
    const { component, receiveBack } = setup();
    component.formGroup.controls.goodQuantity.setValue(0);
    component.formGroup.controls.scrapQuantity.setValue(10);

    component.save();

    expect(receiveBack).toHaveBeenCalledWith(5, { receivedQuantity: 0, scrapQuantity: 10, passedInspection: false });
  });

  it('blocks a return with nothing back and clears once scrap is entered', () => {
    const { component, receiveBack } = setup();
    component.formGroup.controls.goodQuantity.setValue(0);

    expect(component.formGroup.controls.goodQuantity.hasError('nothingBack')).toBe(true);
    component.save();
    expect(receiveBack).not.toHaveBeenCalled();

    component.formGroup.controls.scrapQuantity.setValue(3);
    expect(component.formGroup.valid).toBe(true);
  });
});
