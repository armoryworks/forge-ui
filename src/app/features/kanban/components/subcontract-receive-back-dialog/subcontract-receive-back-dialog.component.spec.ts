import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractService } from '../../services/subcontract.service';
import { SubcontractReceiveBackDialogComponent } from './subcontract-receive-back-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const order = { id: 5, quantity: 10, vendorName: 'Plating Co', operationName: 'Anodize', status: 'Sent' } as SubcontractOrder;

function setup(source: SubcontractOrder = order, roles: string[] = []) {
  const close = vi.fn();
  const receiveBack = vi.fn(() => of({ ...order, status: 'Complete' } as SubcontractOrder));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: { order: source } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
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

  it('blocks good plus scrap above what was sent when there is no tolerance', () => {
    const { component, receiveBack } = setup();
    component.formGroup.controls.scrapQuantity.setValue(1);

    expect(component.formGroup.hasError('overTolerance')).toBe(true);
    component.save();
    expect(receiveBack).not.toHaveBeenCalled();

    component.formGroup.controls.goodQuantity.setValue(9);
    expect(component.formGroup.valid).toBe(true);
  });

  const banded = { ...order, quantity: 100, maxAcceptedQuantity: 110, minCompleteQuantity: 90, overTolerancePct: 10, underTolerancePct: 10 } as SubcontractOrder;

  it('accepts a return inside the over tolerance without a reason', () => {
    const { component, receiveBack } = setup(banded);
    component.formGroup.controls.goodQuantity.setValue(108);

    expect(component.formGroup.valid).toBe(true);
    component.save();
    expect(receiveBack).toHaveBeenCalledWith(5, { receivedQuantity: 108, scrapQuantity: 0, passedInspection: true });
  });

  it('sends a manager-confirmed over-tolerance return with its reason', () => {
    const { component, receiveBack } = setup(banded, ['Manager']);
    component.formGroup.controls.goodQuantity.setValue(130);
    expect(component.formGroup.valid).toBe(false);

    component.formGroup.controls.overReason.setValue('Yield came in high');
    component.save();

    expect(receiveBack).toHaveBeenCalledWith(5, expect.objectContaining({
      receivedQuantity: 130, confirmOverTolerance: true, overToleranceReason: 'Yield came in high',
    }));
  });

  it('keeps an over-tolerance return blocked for a user who cannot accept it', () => {
    const { component } = setup(banded, ['Engineer']);
    component.formGroup.controls.goodQuantity.setValue(130);
    component.formGroup.controls.overReason.setValue('Extra');

    expect(component.formGroup.hasError('overTolerance')).toBe(true);
  });

  it('can close a return below the under tolerance short', () => {
    const { component, receiveBack } = setup(banded);
    component.formGroup.controls.goodQuantity.setValue(70);
    component.formGroup.controls.closeShort.setValue(true);

    component.save();

    expect(receiveBack).toHaveBeenCalledWith(5, expect.objectContaining({ receivedQuantity: 70, closeShort: true }));
  });

  it('defaults the good quantity to what is still out after an earlier receive-back', () => {
    const { component } = setup({ ...banded, receivedQuantity: 60, scrapQuantity: 5 } as SubcontractOrder);

    expect(component.formGroup.controls.goodQuantity.value).toBe(35);
  });
});
