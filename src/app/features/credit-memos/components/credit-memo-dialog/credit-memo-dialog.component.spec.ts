import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CreditMemoDialogComponent } from './credit-memo-dialog.component';
import { CreditMemoService } from '../../services/credit-memo.service';
import { CreditMemoDetail } from '../../models/credit-memo-detail.model';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogInternals {
  form: FormGroup;
  lines(): { description: string; quantity: number; unitPrice: number }[];
  isEdit(): boolean;
  invoice: { set(value: unknown): void };
  unappliedHintKey(): string | null;
  canSave(): boolean;
  save(): void;
  ngOnInit(): void;
}

const draft = (overrides: Partial<CreditMemoDetail> = {}): CreditMemoDetail => ({
  id: 4, creditMemoNumber: 'CM-000004', customerId: 1, customerName: 'Acme', invoiceId: null, invoiceNumber: null,
  customerReturnId: null, returnNumber: null, reasonType: 'Other', reason: 'Price match', status: 'Draft',
  creditDate: '2026-03-10T00:00:00Z', taxRate: 0.05, subtotal: 50, taxAmount: 2.5, total: 52.5, amountApplied: 0,
  amountRefunded: 0, openAmount: 0, currencyId: 1, currencyCode: 'USD', fxRate: 1, notes: 'n', issuedAt: null,
  voidedAt: null, voidReason: null, issueJournalEntryId: null,
  lines: [{ id: 9, lineNumber: 1, lineType: 'Item', partId: null, partNumber: null, invoiceLineId: null,
    description: 'Price match', quantity: 2, unitPrice: 25, taxable: true, lineTotal: 50 }],
  applications: [], refunds: [], createdAt: '', updatedAt: '', rowVersion: 7, ...overrides,
});

describe('CreditMemoDialogComponent', () => {
  let service: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let invoiceService: { getInvoiceById: ReturnType<typeof vi.fn>; getInvoices: ReturnType<typeof vi.fn> };

  const build = (memo: CreditMemoDetail | null): { dialog: DialogInternals; saved: number[] } => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CreditMemoService, useValue: service },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(CreditMemoDialogComponent);
    fixture.componentRef.setInput('memo', memo);
    const saved: number[] = [];
    fixture.componentInstance.saved.subscribe(id => saved.push(id));
    const dialog = fixture.componentInstance as unknown as DialogInternals;
    dialog.ngOnInit();
    return { dialog, saved };
  };

  beforeEach(() => {
    service = { create: vi.fn(() => of(draft())), update: vi.fn(() => of(draft())) };
    invoiceService = { getInvoiceById: vi.fn(() => of(null)), getInvoices: vi.fn(() => of([])) };
  });

  it('opens a draft with its header and lines and locks the customer', () => {
    const { dialog } = build(draft());

    expect(dialog.isEdit()).toBe(true);
    expect(dialog.form.controls['reason'].value).toBe('Price match');
    expect(dialog.form.controls['taxRate'].value).toBe(5);
    expect(dialog.form.controls['customerId'].disabled).toBe(true);
    expect(dialog.lines()).toEqual([expect.objectContaining({ description: 'Price match', quantity: 2, unitPrice: 25 })]);
    expect(dialog.canSave()).toBe(true);
  });

  it('saves a draft through the update call with its row version', () => {
    const { dialog, saved } = build(draft());
    dialog.form.controls['reason'].setValue('Price match, revised');

    dialog.save();

    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).toHaveBeenCalledWith(4, expect.objectContaining({
      reason: 'Price match, revised', taxRate: 0.05, lines: [expect.objectContaining({ quantity: 2, unitPrice: 25 })],
    }), 7);
    expect(saved).toEqual([4]);
  });

  it('loads the credited invoice of a linked draft without clearing its lines', () => {
    const { dialog } = build(draft({ invoiceId: 12, invoiceNumber: 'INV-12' }));

    expect(invoiceService.getInvoiceById).toHaveBeenCalledWith(12);
    expect(dialog.lines()).toHaveLength(1);
    expect(dialog.form.controls['invoiceId'].disabled).toBe(true);
  });

  it('explains that a credit on a deposit-covered invoice is issued unapplied', () => {
    const { dialog } = build(null);
    expect(dialog.unappliedHintKey()).toBeNull();

    dialog.invoice.set({ id: 3, invoiceNumber: 'INV-3', balanceDue: 0, lines: [{ id: 1, lineType: 'Deposit' }] });
    expect(dialog.unappliedHintKey()).toBe('creditMemos.unappliedDepositHint');

    dialog.invoice.set({ id: 3, invoiceNumber: 'INV-3', balanceDue: 0, lines: [{ id: 1, lineType: 'Item' }] });
    expect(dialog.unappliedHintKey()).toBe('creditMemos.unappliedPaidHint');

    dialog.invoice.set({ id: 3, invoiceNumber: 'INV-3', balanceDue: 40, lines: [{ id: 1, lineType: 'Deposit' }] });
    expect(dialog.unappliedHintKey()).toBeNull();
  });

  it('creates a new memo when no draft is given', () => {
    const { dialog } = build(null);

    expect(dialog.isEdit()).toBe(false);
    expect(dialog.form.controls['customerId'].enabled).toBe(true);
  });
});
