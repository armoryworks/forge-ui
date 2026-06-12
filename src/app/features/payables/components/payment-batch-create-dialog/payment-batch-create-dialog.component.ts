import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { BankingService } from '../../services/banking.service';
import { BatchEligiblePayment } from '../../models/batch-eligible-payment.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { toIsoDate } from '../../../../shared/utils/date.utils';

// ⚡ BANKING BOUNDARY — assemble a NACHA batch. Payment mode: pick eligible ACH payments
// (vendors without a payable bank account are visibly blocked). Prenote mode: every Approved
// account rides automatically — only the effective date is chosen. Selection is explicit
// button-committed work (no autosave), matching the app's batch-save convention.
@Component({
  selector: 'app-payment-batch-create-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, CurrencyPipe, DatePipe,
    DialogComponent, DatepickerComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './payment-batch-create-dialog.component.html',
  styleUrl: './payment-batch-create-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentBatchCreateDialogComponent implements OnInit {
  private readonly bankingService = inject(BankingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  /** True = zero-dollar prenote batch (no payment selection). */
  readonly prenote = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly eligible = signal<BatchEligiblePayment[]>([]);
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());

  protected readonly selectedTotal = computed(() => this.eligible()
    .filter(e => this.selectedIds().has(e.vendorPaymentId))
    .reduce((sum, e) => sum + e.amount, 0));

  protected readonly form = new FormGroup({
    effectiveEntryDate: new FormControl<Date | null>(this.defaultEffectiveDate(), [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    effectiveEntryDate: this.translate.instant('payables.batches.effectiveDate'),
  });

  ngOnInit(): void {
    // Prenote batches need no selection — the server includes every Approved account.
    if (!this.prenote()) {
      this.loadEligible();
    }
  }

  private loadEligible(): void {
    this.loading.set(true);
    this.bankingService.getEligiblePayments().subscribe({
      next: (list) => {
        this.eligible.set(list);
        // Preselect everything batchable — the common case is "pay the run".
        this.selectedIds.set(new Set(list.filter(e => e.bankAccountId !== null).map(e => e.vendorPaymentId)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggle(payment: BatchEligiblePayment): void {
    if (payment.bankAccountId === null) return; // not batchable
    const next = new Set(this.selectedIds());
    if (!next.delete(payment.vendorPaymentId)) {
      next.add(payment.vendorPaymentId);
    }
    this.selectedIds.set(next);
  }

  protected isSelected(payment: BatchEligiblePayment): boolean {
    return this.selectedIds().has(payment.vendorPaymentId);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const date = toIsoDate(this.form.controls.effectiveEntryDate.value)!;

    if (!this.prenote() && this.selectedIds().size === 0) {
      this.snackbar.error(this.translate.instant('payables.batches.selectAtLeastOne'));
      return;
    }

    this.saving.set(true);
    const request$ = this.prenote()
      ? this.bankingService.createPrenoteBatch(date)
      : this.bankingService.createBatch([...this.selectedIds()], date);

    request$.subscribe({
      next: (batch) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('payables.batches.created', { number: batch.batchNumber }));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  /** Next business day — ACH effective dates can't be today by upload time in practice. */
  private defaultEffectiveDate(): Date {
    const date = new Date();
    do {
      date.setDate(date.getDate() + 1);
    } while (date.getDay() === 0 || date.getDay() === 6);
    return date;
  }
}
