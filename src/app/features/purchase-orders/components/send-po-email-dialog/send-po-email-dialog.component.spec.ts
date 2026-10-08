import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SendPoEmailDialogData } from '../../models/send-po-email-dialog-data.model';
import { SendPoEmailDialogComponent } from './send-po-email-dialog.component';

interface DialogApi {
  form: FormGroup;
  send(): void;
  close(): void;
}

describe('SendPoEmailDialogComponent', () => {
  const dialogRef = { close: vi.fn() };
  const snackbar = { success: vi.fn() };
  const sendPurchaseOrderEmail = vi.fn();

  function create(data: Partial<SendPoEmailDialogData> = {}): DialogApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { purchaseOrderId: 42, poNumber: 'PO-42', vendorName: 'Vendor', recipientEmail: 'buyer@vendor.test', ...data },
        },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: PurchaseOrderService, useValue: { sendPurchaseOrderEmail } },
      ],
    });
    TestBed.overrideComponent(SendPoEmailDialogComponent, { set: { template: '', imports: [] } });
    return TestBed.createComponent(SendPoEmailDialogComponent).componentInstance as unknown as DialogApi;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    sendPurchaseOrderEmail.mockReturnValue(of(undefined));
  });

  it('prefills the recipient from the caller', () => {
    const api = create({ recipientEmail: 'contact@vendor.test' });
    expect(api.form.get('to')!.value).toBe('contact@vendor.test');
  });

  it('will not send without a recipient', () => {
    const api = create({ recipientEmail: '' });
    api.send();
    expect(sendPurchaseOrderEmail).not.toHaveBeenCalled();
  });

  it('rejects a cc list that holds an invalid address', () => {
    const api = create();
    api.form.get('cc')!.setValue('ap@vendor.test, not-an-address');
    expect(api.form.get('cc')!.invalid).toBe(true);
    api.send();
    expect(sendPurchaseOrderEmail).not.toHaveBeenCalled();
  });

  it('sends the trimmed recipient, cc list and message, then closes with true', () => {
    const api = create();
    api.form.get('to')!.setValue('  buyer@vendor.test ');
    api.form.get('cc')!.setValue('ap@vendor.test; qa@vendor.test,');
    api.form.get('message')!.setValue('  Please confirm the ship date. ');
    api.send();

    expect(sendPurchaseOrderEmail).toHaveBeenCalledWith(42, {
      to: 'buyer@vendor.test',
      cc: 'ap@vendor.test, qa@vendor.test',
      message: 'Please confirm the ship date.',
    });
    expect(snackbar.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('omits empty cc and message', () => {
    const api = create();
    api.send();
    expect(sendPurchaseOrderEmail).toHaveBeenCalledWith(42, { to: 'buyer@vendor.test', cc: undefined, message: undefined });
  });

  it('stays open when the send fails', () => {
    sendPurchaseOrderEmail.mockReturnValue(throwError(() => new Error('smtp down')));
    const api = create();
    api.send();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes with no result on cancel', () => {
    const api = create();
    api.close();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
