import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

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

@Component({
  selector: 'app-invoice-detail-panel',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TranslatePipe, RouterLink, ReactiveFormsModule,
    MatTooltipModule, LoadingBlockDirective,
    EntityActivitySectionComponent, EntityLinkComponent, CurrencyDisplayComponent, InputComponent,
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
  protected readonly invoice = signal<InvoiceDetail | null>(null);

  protected readonly invoiceIdValue = computed(() => this.invoice()?.id ?? 0);

  // Inline rename of the invoice number — only offered while Draft and when the
  // tenant allows manual numbers. Backed by the dedicated rename endpoint.
  protected readonly numberControl = new FormControl('');
  protected readonly editingNumber = signal(false);
  protected readonly savingNumber = signal(false);
  protected readonly canEditNumber = computed(() =>
    this.manualNumbers.isEnabled('invoices') && this.invoice()?.status === 'Draft',
  );

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
    this.invoiceService.renameInvoiceNumber(inv.id, next).subscribe({
      next: () => {
        this.savingNumber.set(false);
        this.editingNumber.set(false);
        this.loadInvoice(inv.id);
        this.invoiceChanged.emit();
        this.snackbar.success(this.translate.instant('invoices.invoiceNumberUpdated'));
      },
      error: () => this.savingNumber.set(false),
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
      this.invoiceService.deleteInvoice(inv.id).subscribe({
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
  protected canVoid(status: string): boolean { return status === 'Draft' || status === 'Sent'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  private loadInvoice(id: number): void {
    this.loading.set(true);
    this.invoiceService.getInvoiceById(id).subscribe({
      next: (detail) => {
        this.invoice.set(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
