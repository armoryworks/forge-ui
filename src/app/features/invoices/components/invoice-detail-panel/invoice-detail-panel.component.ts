import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InvoiceService } from '../../services/invoice.service';
import { InvoiceDetail } from '../../models/invoice-detail.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-invoice-detail-panel',
  standalone: true,
  imports: [
    DatePipe, CurrencyPipe, TranslatePipe,
    MatTooltipModule, LoadingBlockDirective,
    EntityActivitySectionComponent, EntityLinkComponent,
  ],
  templateUrl: './invoice-detail-panel.component.html',
  styleUrl: './invoice-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailPanelComponent {
  private readonly invoiceService = inject(InvoiceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly invoiceId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<InvoiceDetail>();
  readonly invoiceChanged = output<void>();

  protected readonly loading = signal(false);
  protected readonly invoice = signal<InvoiceDetail | null>(null);

  protected readonly invoiceIdValue = computed(() => this.invoice()?.id ?? 0);

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

  protected sendInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.invoiceService.sendInvoice(inv.id).subscribe({
      next: () => {
        this.loadInvoice(inv.id);
        this.invoiceChanged.emit();
        this.snackbar.success(this.translate.instant('invoices.invoiceSent'));
      },
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
