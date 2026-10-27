import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SampleShipmentsService } from '../../services/sample-shipments.service';
import { SendSampleDialogComponent, SendSampleDialogData } from './send-sample-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = { form: FormGroup; save(): void; saving(): boolean; onPartPicked(p: Record<string, unknown> | null): void };

describe('SendSampleDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let success: ReturnType<typeof vi.fn>;

  function open(data: SendSampleDialogData): Internals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: SampleShipmentsService, useValue: { create } },
        { provide: SnackbarService, useValue: { success } },
      ],
    });
    return TestBed.runInInjectionContext(() => new SendSampleDialogComponent()) as unknown as Internals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    close = vi.fn();
    success = vi.fn();
    create = vi.fn(() => of({ id: 3, status: 'Shipped' }));
  });

  it('sends a customer sample with ship-to, tracking and follow-up and closes with it', () => {
    const c = open({ customerId: 12, recipientName: 'Acme' });
    c.onPartPicked({ id: 40, partNumber: 'BRK-1', name: 'Bracket' });
    c.form.patchValue({
      partId: 40, quantity: 2, shipToAddress: ' 1 Main St ', carrier: 'UPS', trackingNumber: '1Z9',
      followUpDate: new Date(2026, 10, 20),
    });

    c.save();

    expect(create).toHaveBeenCalledWith({
      leadId: null, customerId: 12, partId: 40, partDescription: 'Bracket', quantity: 2,
      shipToAddress: '1 Main St', carrier: 'UPS', trackingNumber: '1Z9', followUpDate: '2026-11-20T00:00:00Z', notes: null,
    });
    expect(success).toHaveBeenCalledWith('leads.sendSample.shipped');
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('needs a description and a whole quantity of at least one', () => {
    const c = open({ leadId: 4, recipientName: 'Prospect' });
    c.form.patchValue({ partDescription: '', quantity: 0 });

    c.save();

    expect(c.form.get('partDescription')!.hasError('required')).toBe(true);
    expect(c.form.get('quantity')!.hasError('min')).toBe(true);
    expect(create).not.toHaveBeenCalled();
    c.form.patchValue({ partDescription: 'Coupon', quantity: 1.5 });
    expect(c.form.get('quantity')!.hasError('pattern')).toBe(true);
  });

  it('keeps the dialog open and re-enables save when the server refuses', () => {
    create = vi.fn(() => throwError(() => new Error('403')));
    const c = open({ leadId: 4, recipientName: 'Prospect' });
    c.form.patchValue({ partDescription: 'Coupon' });

    c.save();

    expect(close).not.toHaveBeenCalled();
    expect(c.saving()).toBe(false);
  });
});
