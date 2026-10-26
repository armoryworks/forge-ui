import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InvoiceService } from '../../services/invoice.service';
import { InvoiceDetail } from '../../models/invoice-detail.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DiscountChipComponent } from '../../../../shared/components/discount-chip/discount-chip.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ConfirmSendService } from '../../../../shared/services/confirm-send.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { NumberLockInfoComponent } from '../../../../shared/components/number-lock-info/number-lock-info.component';
import { DetailLoadErrorComponent } from '../../../../shared/components/detail-load-error/detail-load-error.component';
import { downloadBlob } from '../../../../shared/utils/download-blob';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { SendInvoiceEmailDialogComponent } from '../send-invoice-email-dialog/send-invoice-email-dialog.component';
import { SendInvoiceEmailDialogData } from '../../models/send-invoice-email-dialog-data.model';
import { EnumLabelPipe } from '../../../../shared/pipes/enum-label.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CreditMemoService } from '../../../credit-memos/services/credit-memo.service';
import { CreditMemoDialogComponent } from '../../../credit-memos/components/credit-memo-dialog/credit-memo-dialog.component';
import { EdiSendActionComponent } from '../../../admin/components/edi-send-action/edi-send-action.component';

const EMAILABLE_STATUSES = new Set(['Sent', 'PartiallyPaid', 'Overdue', 'Paid']);
const VOIDABLE_STATUSES = new Set(['Sent', 'Overdue']);
const CREDITABLE_STATUSES = new Set(['Sent', 'PartiallyPaid', 'Overdue', 'Paid']);
const WRITE_OFF_STATUSES = new Set(['Sent', 'PartiallyPaid', 'Overdue']);

@Component({
  selector: 'app-invoice-detail-panel',
  standalone: true,
  imports: [
    EnumLabelPipe,
    DateOnlyPipe, NumberLockInfoComponent, DatePipe, DecimalPipe, TranslatePipe, RouterLink, ReactiveFormsModule,
    MatTooltipModule, LoadingBlockDirective,
    EntityActivitySectionComponent, EntityLinkComponent, CurrencyDisplayComponent, InputComponent,
    DetailLoadErrorComponent, DiscountChipComponent,
    DialogComponent, TextareaComponent, ValidationButtonComponent, CreditMemoDialogComponent,
    EdiSendActionComponent,
  ],
  templateUrl: './invoice-detail-panel.component.html',
  styleUrl: './invoice-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailPanelComponent {
  private readonly invoiceService = inject(InvoiceService);
  private readonly confirmSend = inject(ConfirmSendService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly manualNumbers = inject(ManualNumberSettingsService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly creditMemos = inject(CreditMemoService);
  private readonly router = inject(Router);

  readonly invoiceId = input.required<number>();
  readonly closed = output<void>();
  readonly invoiceChanged = output<void>();

  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly invoice = signal<InvoiceDetail | null>(null);

  protected readonly invoiceIdValue = computed(() => this.invoice()?.id ?? 0);
  protected readonly currencyCode = computed(() => this.invoice()?.currencyCode ?? null);
  protected readonly sortedLines = computed(() => {
    const lines = this.invoice()?.lines ?? [];
    return [
      ...lines.filter(l => l.lineType !== 'Freight' && l.lineType !== 'Deposit'),
      ...lines.filter(l => l.lineType === 'Freight'),
      ...lines.filter(l => l.lineType === 'Deposit'),
    ];
  });
  protected readonly freightSubtotal = computed(() => this.invoice()?.freightSubtotal ?? 0);
  protected readonly itemsSubtotal = computed(() => (this.invoice()?.subtotal ?? 0) - this.freightSubtotal());
  protected readonly downloadingPdf = signal(false);

  // Inline rename of the invoice number — only offered while Draft and when the
  // tenant allows manual numbers. Backed by the dedicated rename endpoint.
  protected readonly numberControl = new FormControl('', [Validators.maxLength(20)]);
  protected readonly editingNumber = signal(false);
  protected readonly savingNumber = signal(false);
  /** Manual numbering is on, but this record's lifecycle fixes the number. */
  protected readonly numberLocked = computed(() => this.manualNumbers.isEnabled('invoices') && !this.canEditNumber());
  protected readonly canEditNumber = computed(() =>
    this.manualNumbers.isEnabled('invoices') && this.invoice()?.status === 'Draft',
  );
  protected readonly canEmail = computed(() => EMAILABLE_STATUSES.has(this.invoice()?.status ?? ''));

  private readonly creditMemosOn = computed(() => this.capabilities.isEnabled('CAP-O2C-CREDITMEMO'));
  protected readonly creditsApplied = computed(() => this.invoice()?.creditsApplied ?? 0);
  protected readonly canIssueCreditMemo = computed(() =>
    this.creditMemosOn() && this.auth.hasAnyRole(['Admin', 'Manager', 'OfficeManager'])
    && CREDITABLE_STATUSES.has(this.invoice()?.status ?? ''));
  protected readonly canWriteOff = computed(() =>
    this.creditMemosOn() && this.auth.hasAnyRole(['Admin', 'Manager'])
    && WRITE_OFF_STATUSES.has(this.invoice()?.status ?? '') && (this.invoice()?.balanceDue ?? 0) > 0);
  protected readonly showCreditMemoDialog = signal(false);
  protected readonly showWriteOffDialog = signal(false);
  protected readonly writingOff = signal(false);
  protected readonly writeOffForm = new FormGroup({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
  });
  protected readonly writeOffViolations = FormValidationService.getViolations(this.writeOffForm, {
    amount: this.translate.instant('creditMemos.writeOffAmount'),
    reason: this.translate.instant('creditMemos.writeOffReason'),
  });

  constructor() {
    effect(() => {
      const id = this.invoiceId();
      if (id) {
        this.loadInvoice(id);
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected startEditNumber(): void {
    this.numberControl.setValue(this.invoice()?.invoiceNumber ?? '');
    this.editingNumber.set(true);
  }

  protected cancelEditNumber(): void {
    this.editingNumber.set(false);
  }

  protected saveNumber(): void {
    const inv = this.invoice();
    const next = this.numberControl.value?.trim();
    if (!inv || !next) return;
    this.savingNumber.set(true);
    this.invoiceService.renameInvoiceNumber(inv.id, next, inv.rowVersion).subscribe({
      next: () => {
        this.savingNumber.set(false);
        this.editingNumber.set(false);
        this.loadInvoice(inv.id);
        this.invoiceChanged.emit();
        this.snackbar.success(this.translate.instant('invoices.invoiceNumberUpdated'));
      },
      error: () => {
        this.savingNumber.set(false);
        this.loadInvoice(inv.id);
      },
    });
  }

  protected sendInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.confirmSend.confirmSend({
      titleKey: 'invoices.confirmSendTitle',
      messageKey: 'invoices.confirmSendMessage',
      messageParams: { number: inv.invoiceNumber },
      confirmLabelKey: 'invoices.send',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.invoiceService.sendInvoice(inv.id).subscribe({
        next: () => {
          this.loadInvoice(inv.id);
          this.invoiceChanged.emit();
          this.snackbar.success(this.translate.instant('invoices.invoiceSent'));
        },
      });
    });
  }

  protected emailInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.dialog.open<SendInvoiceEmailDialogComponent, SendInvoiceEmailDialogData, boolean | undefined>(
      SendInvoiceEmailDialogComponent,
      {
        width: '520px',
        data: { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, customerName: inv.customerName },
      },
    ).afterClosed().subscribe(sent => {
      if (sent) this.invoiceChanged.emit();
    });
  }

  protected downloadPdf(): void {
    const inv = this.invoice();
    if (!inv || this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.invoiceService.getInvoicePdf(inv.id).subscribe({
      next: (blob) => {
        this.downloadingPdf.set(false);
        downloadBlob(blob, `${inv.invoiceNumber || `invoice-${inv.id}`}.pdf`);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }

  protected voidInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('invoices.voidInvoiceTitle'),
        message: this.translate.instant('invoices.voidInvoiceMessage', { number: inv.invoiceNumber }),
        confirmLabel: this.translate.instant('invoices.void'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.invoiceService.voidInvoice(inv.id).subscribe({
        next: () => {
          this.loadInvoice(inv.id);
          this.invoiceChanged.emit();
          this.snackbar.success(this.translate.instant('invoices.invoiceVoided'));
        },
      });
    });
  }

  protected deleteInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('invoices.deleteInvoiceTitle'),
        message: this.translate.instant('invoices.deleteInvoiceMessage', { number: inv.invoiceNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.invoiceService.deleteInvoice(inv.id, inv.rowVersion).subscribe({
        next: () => {
          this.invoiceChanged.emit();
          this.closed.emit();
          this.snackbar.success(this.translate.instant('invoices.invoiceDeleted'));
        },
      });
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Sent: 'chip--info',
      PartiallyPaid: 'chip--warning',
      Paid: 'chip--success',
      Overdue: 'chip--error',
      Voided: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'invoices.status' + status;
    return this.translate.instant(key);
  }

  protected canSend(status: string): boolean { return status === 'Draft'; }
  protected canVoid(status: string): boolean { return VOIDABLE_STATUSES.has(status) && this.creditsApplied() === 0; }

  protected onCreditMemoCreated(id: number): void {
    this.showCreditMemoDialog.set(false);
    void this.router.navigate(['/credit-memos'], { queryParams: { detail: `credit-memo:${id}` } });
  }

  protected openWriteOff(): void {
    const balance = this.invoice()?.balanceDue ?? 0;
    this.writeOffForm.reset({ amount: balance, reason: '' });
    this.writeOffForm.controls.amount.setValidators([Validators.required, Validators.min(0.01), Validators.max(balance)]);
    this.writeOffForm.controls.amount.updateValueAndValidity();
    this.showWriteOffDialog.set(true);
  }

  protected confirmWriteOff(): void {
    const inv = this.invoice();
    if (!inv || this.writeOffForm.invalid || this.writingOff()) return;
    const f = this.writeOffForm.getRawValue();
    const amount = Math.round((f.amount ?? 0) * 100) / 100;
    this.writingOff.set(true);
    this.creditMemos.writeOffInvoice(inv.id, amount === inv.balanceDue ? null : amount, f.reason.trim()).subscribe({
      next: memo => {
        this.writingOff.set(false);
        this.showWriteOffDialog.set(false);
        this.loadInvoice(inv.id);
        this.invoiceChanged.emit();
        this.snackbar.success(this.translate.instant('creditMemos.writtenOff', { number: inv.invoiceNumber, memo: memo.creditMemoNumber }));
      },
      error: () => this.writingOff.set(false),
    });
  }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  private loadInvoice(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.invoiceService.getInvoiceById(id).subscribe({
      next: (detail) => {
        this.invoice.set(detail);
        this.loading.set(false);
      },
      error: (err: unknown) => { this.loading.set(false); this.loadError.set(err); },
    });
  }
}
