import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { QuoteService } from '../../services/quote.service';
import { QuoteDetail } from '../../models/quote-detail.model';
import { QuoteLine } from '../../models/quote-line.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { ConfirmSendService } from '../../../../shared/services/confirm-send.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { FileAttachment } from '../../../../shared/models/file.model';

@Component({
  selector: 'app-quote-detail-panel',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TranslatePipe, ReactiveFormsModule,
    MatTooltipModule, LoadingBlockDirective,
    EntityActivitySectionComponent, FileUploadZoneComponent,
    EntityLinkComponent, CurrencyDisplayComponent,
    EntityPickerComponent, InputComponent, CurrencyInputComponent,
  ],
  templateUrl: './quote-detail-panel.component.html',
  styleUrl: './quote-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDetailPanelComponent {
  private readonly quoteService = inject(QuoteService);
  private readonly confirmSend = inject(ConfirmSendService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly quoteId = input.required<number>();
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly loading = signal(false);
  protected readonly quote = signal<QuoteDetail | null>(null);
  protected readonly documents = signal<FileAttachment[]>([]);

  protected readonly quoteIdValue = computed(() => this.quoteId());

  // --- Line editing (Draft only) ---
  // editingLineId: null = editor closed, 0 = adding a new line, >0 = editing that line.
  protected readonly editingLineId = signal<number | null>(null);
  protected readonly savingLine = signal(false);
  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.0001)] }),
    unitPrice: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });

  constructor() {
    effect(() => {
      const id = this.quoteId();
      if (id) {
        this.loadQuote(id);
        this.loadDocuments(id);
      }
    });
  }

  private loadQuote(id: number): void {
    this.loading.set(true);
    this.quoteService.getQuoteById(id).subscribe({
      next: (detail) => { this.quote.set(detail); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  // --- Status Actions ---
  protected sendQuote(): void {
    const q = this.quote();
    if (!q) return;
    this.confirmSend.confirmSend({
      titleKey: 'quotes.confirmSendTitle',
      messageKey: 'quotes.confirmSendMessage',
      messageParams: { number: q.quoteNumber },
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.sendQuote(q.id).subscribe({
        next: () => {
          this.loadQuote(q.id);
          this.changed.emit();
          this.snackbar.success(this.translate.instant('quotes.quoteSent'));
        },
      });
    });
  }

  protected acceptQuote(): void {
    const q = this.quote();
    if (!q) return;
    this.quoteService.acceptQuote(q.id).subscribe({
      next: () => {
        this.loadQuote(q.id);
        this.changed.emit();
        this.snackbar.success(this.translate.instant('quotes.quoteAccepted'));
      },
    });
  }

  protected rejectQuote(): void {
    const q = this.quote();
    if (!q) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('quotes.rejectQuoteTitle'),
        message: this.translate.instant('quotes.rejectQuoteMessage', { number: q.quoteNumber }),
        confirmLabel: this.translate.instant('quotes.reject'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.rejectQuote(q.id).subscribe({
        next: () => {
          this.loadQuote(q.id);
          this.changed.emit();
          this.snackbar.success(this.translate.instant('quotes.quoteRejected'));
        },
      });
    });
  }

  protected convertToOrder(): void {
    const q = this.quote();
    if (!q) return;
    this.quoteService.convertToOrder(q.id).subscribe({
      next: (order) => {
        this.loadQuote(q.id);
        this.changed.emit();
        this.snackbar.success(this.translate.instant('quotes.quoteConverted', { number: order.orderNumber ?? '' }));
      },
    });
  }

  protected deleteQuote(): void {
    const q = this.quote();
    if (!q) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('quotes.deleteQuoteTitle'),
        message: this.translate.instant('quotes.deleteQuoteMessage', { number: q.quoteNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.deleteQuote(q.id).subscribe({
        next: () => {
          this.changed.emit();
          this.closed.emit();
          this.snackbar.success(this.translate.instant('quotes.quoteDeleted'));
        },
      });
    });
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Sent: 'chip--info',
      Accepted: 'chip--success',
      Declined: 'chip--error',
      Expired: 'chip--warning',
      ConvertedToOrder: 'chip--primary',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'quotes.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected canSend(status: string): boolean { return status === 'Draft'; }
  protected canAccept(status: string): boolean { return status === 'Sent'; }
  protected canReject(status: string): boolean { return status === 'Sent'; }
  protected canConvert(status: string): boolean { return status === 'Accepted'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  // --- Line editing ---
  protected canEditLines(status: string): boolean { return status === 'Draft'; }

  protected startAddLine(): void {
    this.lineForm.reset({ partId: null, description: '', quantity: 1, unitPrice: 0 });
    this.editingLineId.set(0);
  }

  protected editLine(line: QuoteLine): void {
    this.lineForm.reset({
      partId: line.partId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    });
    this.editingLineId.set(line.id);
  }

  protected cancelLineEdit(): void {
    this.editingLineId.set(null);
  }

  /** Prefill description + customer-specific unit price from the chosen catalog part. */
  protected onPartSelected(part: Record<string, unknown> | null): void {
    if (!part) return;
    const name = (part['name'] as string) ?? '';
    if (name && !this.lineForm.controls.description.value) {
      this.lineForm.controls.description.setValue(name);
    }
    // #26: pre-populate the row's unit price from the customer's price list when a
    // catalog part is picked. Leaves the field for manual entry when no price resolves.
    const q = this.quote();
    const partId = part['id'] as number | undefined;
    if (q && partId) {
      this.quoteService.resolvePrice(q.customerId, partId).subscribe({
        next: price => {
          if (price != null) this.lineForm.controls.unitPrice.setValue(price);
        },
        error: () => { /* price stays manual-entry; global interceptor surfaces hard errors */ },
      });
    }
  }

  protected saveLine(): void {
    const q = this.quote();
    const editing = this.editingLineId();
    if (!q || editing === null || this.lineForm.invalid) return;
    const v = this.lineForm.getRawValue();
    this.savingLine.set(true);
    const req = editing === 0
      ? this.quoteService.addQuoteLine(q.id, {
          partId: v.partId ?? undefined,
          description: v.description,
          quantity: v.quantity,
          unitPrice: v.unitPrice,
        })
      : this.quoteService.updateQuoteLine(q.id, editing, {
          description: v.description,
          quantity: v.quantity,
          unitPrice: v.unitPrice,
        });
    req.subscribe({
      next: (detail) => {
        this.quote.set(detail);
        this.editingLineId.set(null);
        this.savingLine.set(false);
        this.changed.emit();
        this.snackbar.success(this.translate.instant(editing === 0 ? 'quotes.lineAdded' : 'quotes.lineUpdated'));
      },
      error: () => this.savingLine.set(false),
    });
  }

  // --- Documents (mirrors the sales-order detail panel's Documents tab) ---

  private loadDocuments(id: number): void {
    this.quoteService.getDocuments(id).subscribe({
      next: (docs) => this.documents.set(docs),
    });
  }

  protected downloadFile(doc: FileAttachment): void {
    window.open(this.quoteService.downloadFileUrl(doc.id), '_blank');
  }

  protected deleteFile(doc: FileAttachment): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('quotes.deleteFileTitle'),
        message: this.translate.instant('quotes.deleteFileMessage', { name: doc.fileName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.deleteFile(doc.id).subscribe({
        next: () => {
          this.documents.update(list => list.filter(f => f.id !== doc.id));
          this.snackbar.success(this.translate.instant('quotes.fileDeleted'));
        },
      });
    });
  }

  protected onFileUploaded(_file: UploadedFile): void {
    this.loadDocuments(this.quoteId());
    this.snackbar.success(this.translate.instant('quotes.fileUploaded'));
  }

  protected getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'table_chart';
    if (contentType.includes('document') || contentType.includes('word')) return 'description';
    return 'attach_file';
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected deleteLine(line: QuoteLine): void {
    const q = this.quote();
    if (!q) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('quotes.deleteLineTitle'),
        message: this.translate.instant('quotes.deleteLineMessage', { description: line.description }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.deleteQuoteLine(q.id, line.id).subscribe({
        next: (detail) => {
          this.quote.set(detail);
          this.changed.emit();
          this.snackbar.success(this.translate.instant('quotes.lineRemoved'));
        },
      });
    });
  }
}
