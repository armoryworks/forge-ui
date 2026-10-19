import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PaymentService } from '../../services/payment.service';
import { PaymentDetail } from '../../models/payment-detail.model';
import { PaymentDetailPanelComponent } from './payment-detail-panel.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

type PanelInternals = {
  payment: { set(v: PaymentDetail | null): void };
  canVoid: () => boolean;
  showVoidDialog: () => boolean;
  voidSaving: () => boolean;
  voidForm: { invalid: boolean; controls: { reason: { setValue(v: string): void } } };
  openVoidDialog(): void;
  confirmVoid(): void;
  closed: { subscribe(cb: () => void): void };
  paymentChanged: { subscribe(cb: () => void): void };
};

describe('PaymentDetailPanelComponent void', () => {
  let panel: PanelInternals;
  let service: { getPaymentById: ReturnType<typeof vi.fn>; voidPayment: ReturnType<typeof vi.fn> };
  let snackbar: { success: ReturnType<typeof vi.fn> };
  const payment = {
    id: 12, paymentNumber: 'PMT-0012', customerId: 3, customerName: 'Acme', applications: [], canVoid: true,
  } as unknown as PaymentDetail;

  beforeEach(() => {
    service = {
      getPaymentById: vi.fn(() => of(payment)),
      voidPayment: vi.fn(() => of(undefined)),
    };
    snackbar = { success: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: PaymentService, useValue: service },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PaymentDetailPanelComponent());
    mockSignalInputs(component, { paymentId: 12 });
    TestBed.flushEffects();
    panel = component as unknown as PanelInternals;
  });

  it('offers Void only when the server says the payment can be voided', () => {
    panel.payment.set(payment);
    expect(panel.canVoid()).toBe(true);

    panel.payment.set({ ...payment, canVoid: false });
    expect(panel.canVoid()).toBe(false);

    panel.payment.set({ ...payment, canVoid: undefined });
    expect(panel.canVoid()).toBe(false);
  });

  it('requires a reason before voiding', () => {
    panel.payment.set(payment);
    panel.openVoidDialog();

    expect(panel.showVoidDialog()).toBe(true);
    expect(panel.voidForm.invalid).toBe(true);
    panel.confirmVoid();

    expect(service.voidPayment).not.toHaveBeenCalled();
  });

  it('voids with the trimmed reason, then closes and tells the list', () => {
    const closed = vi.fn();
    const changed = vi.fn();
    panel.closed.subscribe(closed);
    panel.paymentChanged.subscribe(changed);
    panel.payment.set(payment);
    panel.openVoidDialog();
    panel.voidForm.controls.reason.setValue('  Check bounced  ');

    panel.confirmVoid();

    expect(service.voidPayment).toHaveBeenCalledWith(12, 'Check bounced');
    expect(snackbar.success).toHaveBeenCalled();
    expect(panel.showVoidDialog()).toBe(false);
    expect(changed).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it('keeps the dialog open when the server refuses the void', () => {
    service.voidPayment.mockReturnValue(throwError(() => new Error('409')));
    panel.payment.set(payment);
    panel.openVoidDialog();
    panel.voidForm.controls.reason.setValue('Duplicate entry');

    panel.confirmVoid();

    expect(panel.showVoidDialog()).toBe(true);
    expect(panel.voidSaving()).toBe(false);
  });
});
