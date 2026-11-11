import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SubcontractOperation } from '../../models/subcontract-operation.model';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractService } from '../../services/subcontract.service';
import { SubcontractSendOutDialogComponent } from './subcontract-send-out-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function operation(overrides: Partial<SubcontractOperation> = {}): SubcontractOperation {
  return {
    operationId: 30,
    stepNumber: 20,
    title: 'Anodize',
    vendorId: 4,
    vendorName: 'Plating Co',
    subcontractCost: 3.1,
    turnTimeDays: 5,
    jobQuantity: 40,
    ...overrides,
  };
}

function setup(op: SubcontractOperation, sendOut = vi.fn(() => of({ id: 9, vendorName: 'Plating Co', poNumber: 'PO-00012' } as SubcontractOrder))) {
  const close = vi.fn();
  const success = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: { jobId: 7, operation: op, defaultQuantity: 25 } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: SubcontractService, useValue: { sendOut } },
      { provide: SnackbarService, useValue: { success } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new SubcontractSendOutDialogComponent());
  return { component, sendOut, close, success };
}

describe('SubcontractSendOutDialogComponent', () => {
  it('prefills quantity, vendor, a draft PO and the return date from the turn time', () => {
    const { component } = setup(operation());
    const raw = component.formGroup.getRawValue();

    expect(raw.vendorName).toBe('Plating Co');
    expect(raw.quantity).toBe(25);
    expect(raw.createPurchaseOrder).toBe(true);
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() + 5);
    expect(raw.expectedReturnDate?.getTime()).toBe(expected.getTime());
  });

  it('leaves the return date empty when the routing has no turn time', () => {
    const { component } = setup(operation({ turnTimeDays: null }));
    expect(component.formGroup.controls.expectedReturnDate.value).toBeNull();
  });

  it('sends the operation out with a draft PO and closes with the order', () => {
    const { component, sendOut, close, success } = setup(operation({ turnTimeDays: null }));
    component.formGroup.controls.quantity.setValue(12);

    component.save();

    expect(sendOut).toHaveBeenCalledWith(7, 30, {
      quantity: 12,
      unitCost: 0,
      expectedReturnDate: null,
      createPurchaseOrder: true,
    });
    expect(success).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  it('sends without a PO when the toggle is off', () => {
    const { component, sendOut } = setup(operation());
    component.formGroup.controls.createPurchaseOrder.setValue(false);

    component.save();

    expect(sendOut).toHaveBeenCalledWith(7, 30, expect.objectContaining({ createPurchaseOrder: false }));
  });

  it('does not send an invalid quantity', () => {
    const { component, sendOut } = setup(operation());
    component.formGroup.controls.quantity.setValue(0);

    component.save();

    expect(sendOut).not.toHaveBeenCalled();
  });

  it('refuses a quantity above what the job allows out', () => {
    const { component, sendOut } = setup(operation({ maxSendQuantity: 20 }));

    expect(component.formGroup.controls.quantity.hasError('sendLimit')).toBe(true);
    component.save();
    expect(sendOut).not.toHaveBeenCalled();

    component.formGroup.controls.quantity.setValue(20);
    expect(component.formGroup.valid).toBe(true);
  });

  it('asks for a confirmation before sending past the start quantity', () => {
    const { component, sendOut } = setup(operation({ committedQuantity: 30 }));

    expect(component.formGroup.hasError('overrunAck')).toBe(true);
    component.save();
    expect(sendOut).not.toHaveBeenCalled();

    component.formGroup.controls.overrunAck.setValue(true);
    component.save();

    expect(sendOut).toHaveBeenCalledWith(7, 30, expect.objectContaining({ quantity: 25 }));
  });

  it('asks again when the quantity changes after the confirmation', () => {
    const { component } = setup(operation({ committedQuantity: 30 }));
    component.formGroup.controls.overrunAck.setValue(true);
    expect(component.formGroup.valid).toBe(true);

    component.formGroup.controls.quantity.setValue(50);

    expect(component.formGroup.controls.overrunAck.value).toBe(false);
    expect(component.formGroup.hasError('overrunAck')).toBe(true);
  });

  it('needs no confirmation inside the start quantity', () => {
    const { component } = setup(operation({ committedQuantity: 15 }));

    expect(component.formGroup.valid).toBe(true);
  });

  it('stays open when the send-out fails', () => {
    const { component, close } = setup(operation(), vi.fn(() => throwError(() => new Error('boom'))));

    component.save();

    expect(close).not.toHaveBeenCalled();
  });
});
