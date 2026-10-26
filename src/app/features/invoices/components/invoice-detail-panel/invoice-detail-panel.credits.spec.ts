import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { InvoiceService } from '../../services/invoice.service';
import { InvoiceDetail } from '../../models/invoice-detail.model';
import { InvoiceDetailPanelComponent } from './invoice-detail-panel.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { CreditMemoService } from '../../../credit-memos/services/credit-memo.service';

type PanelInternals = {
  invoice: { set(v: InvoiceDetail): void };
  canWriteOff: () => boolean;
  canIssueCreditMemo: () => boolean;
  canVoid(status: string): boolean;
  openWriteOff(): void;
  writeOffForm: { patchValue(v: Record<string, unknown>): void };
  confirmWriteOff(): void;
};

describe('InvoiceDetailPanelComponent credits', () => {
  let panel: PanelInternals;
  let roles: string[];
  let creditMemos: { writeOffInvoice: ReturnType<typeof vi.fn> };
  const invoice = { id: 7, invoiceNumber: 'INV-0007', status: 'PartiallyPaid', balanceDue: 196, creditsApplied: 0 } as InvoiceDetail;

  const build = () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: InvoiceService, useValue: { getInvoiceById: vi.fn(() => of(invoice)) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-O2C-CREDITMEMO' } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)), hasRole: (r: string) => roles.includes(r) } },
        { provide: CreditMemoService, useValue: creditMemos },
      ],
    });
    panel = TestBed.runInInjectionContext(() => new InvoiceDetailPanelComponent()) as unknown as PanelInternals;
    panel.invoice.set(invoice);
  };

  beforeEach(() => {
    creditMemos = { writeOffInvoice: vi.fn(() => of({ creditMemoNumber: 'CM-000001' })) };
  });

  it('offers a write-off to a Manager and writes off the whole balance', () => {
    roles = ['Manager'];
    build();
    expect(panel.canWriteOff()).toBe(true);
    expect(panel.canIssueCreditMemo()).toBe(true);

    panel.openWriteOff();
    panel.writeOffForm.patchValue({ reason: 'Customer closed' });
    panel.confirmWriteOff();

    expect(creditMemos.writeOffInvoice).toHaveBeenCalledWith(7, null, 'Customer closed');
  });

  it('keeps write-off from an Office Manager but lets them issue a credit memo', () => {
    roles = ['OfficeManager'];
    build();
    expect(panel.canWriteOff()).toBe(false);
    expect(panel.canIssueCreditMemo()).toBe(true);
  });

  it('hides void while credits are applied', () => {
    roles = ['Manager'];
    build();
    panel.invoice.set({ ...invoice, status: 'Sent', creditsApplied: 50 });
    expect(panel.canVoid('Sent')).toBe(false);
  });
});
