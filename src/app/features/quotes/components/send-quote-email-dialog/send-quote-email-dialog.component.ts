import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { QuoteService } from '../../services/quote.service';
import { TermsPreviewSection } from '../../models/quote-terms-preview-section.model';

export interface SendQuoteEmailDialogData {
  quoteId: number;
  quoteNumber?: string;
  customerName?: string;
  /** Optional recipient prefill when the caller already has an email. */
  recipientEmail?: string;
}

/** Result: `true` when the email was sent (dialog resolves undefined on cancel). */
export type SendQuoteEmailDialogResult = boolean;

/**
 * S3 — send-quote-email dialog. Collects a recipient + optional message and
 * shows a read-only preview of the compiled terms & conditions that will ride
 * along with the emailed PDF. On send, POSTs the email (which flips the quote
 * to Sent), toasts, and closes with `true` so the opener can refresh.
 */
@Component({
  selector: 'app-send-quote-email-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, TextareaComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './send-quote-email-dialog.component.html',
  styleUrl: './send-quote-email-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendQuoteEmailDialogComponent {
  private readonly quoteService = inject(QuoteService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef =
    inject(MatDialogRef<SendQuoteEmailDialogComponent, SendQuoteEmailDialogResult | undefined>);
  protected readonly data = inject<SendQuoteEmailDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly previewLoading = signal(true);
  protected readonly sections = signal<TermsPreviewSection[]>([]);
  private readonly expanded = signal<ReadonlySet<number>>(new Set<number>());

  protected readonly form = new FormGroup({
    recipientEmail: new FormControl<string>(this.data.recipientEmail ?? '', {
      nonNullable: true, validators: [Validators.required, Validators.email],
    }),
    message: new FormControl<string>('', {
      nonNullable: true, validators: [Validators.maxLength(2000)],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    recipientEmail: this.translate.instant('quotes.sendEmail.recipient'),
    message: this.translate.instant('quotes.sendEmail.message'),
  });

  constructor() {
    this.quoteService.previewQuoteTerms(this.data.quoteId).subscribe({
      next: (preview) => {
        this.sections.set(preview.sections ?? []);
        this.previewLoading.set(false);
      },
      error: () => this.previewLoading.set(false),
    });
  }

  protected isExpanded(index: number): boolean {
    return this.expanded().has(index);
  }

  protected toggle(index: number): void {
    const next = new Set(this.expanded());
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this.expanded.set(next);
  }

  protected send(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();
    this.quoteService.sendQuoteEmail(this.data.quoteId, {
      recipientEmail: v.recipientEmail.trim(),
      message: v.message.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('quotes.sendEmail.sent'));
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
