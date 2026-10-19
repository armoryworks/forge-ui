import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InvoiceService } from '../../services/invoice.service';
import { InvoiceDetail } from '../../models/invoice-detail.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
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

const EMAILABLE_STATUSES = new Set(['Sent', 'PartiallyPaid', 'Overdue', 'Paid']);
const VOIDABLE_STATUSES = new Set(['Sent', 'Overdue']);

@Component({
  selector: 'app-invoice-detail-panel',
  standalone: true,
  imports: [
    DateOnlyPipe, NumberLockInfoComponent, DatePipe, DecimalPipe, TranslatePipe, RouterLink, ReactiveFormsModule,
    MatTooltipModule, LoadingBlockDirective,
    EntityActivitySectionComponent, EntityLinkComponent, CurrencyDisplayComponent, InputComponent,
    DetailLoadErrorComponent,
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

  readonly invoiceId = input.required<number>();
  readonly closed = output<void>();
  readonly invoiceChanged = output<void>();

  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly invoice = signal<InvoiceDetail | null>(null);

  protected readonly invoiceIdValue = computed(() => this.invoice()?.id ?? 0);
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
  protected canVoid(status: string): boolean { return VOIDABLE_STATUSES.has(status); }
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
