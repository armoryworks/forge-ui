import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { CustomerService } from '../../services/customer.service';
import { CreditRisk, CreditStatus } from '../../models/credit-status.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-credit-status-card',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, PercentPipe, ReactiveFormsModule, DialogComponent, TextareaComponent, LoadingBlockDirective],
  templateUrl: './credit-status-card.component.html',
  styleUrl: './credit-status-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditStatusCardComponent implements OnInit {
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customerId = input.required<number>();
  readonly creditChanged = output<void>();

  protected readonly credit = signal<CreditStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showHoldDialog = signal(false);
  protected readonly holdReason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] });

  ngOnInit(): void {
    this.loadCreditStatus();
  }

  protected openHoldDialog(): void {
    this.holdReason.reset();
    this.showHoldDialog.set(true);
  }

  protected placeHold(): void {
    if (this.holdReason.invalid) return;
    this.saving.set(true);
    this.customerService.placeCreditHold(this.customerId(), this.holdReason.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.success('Credit hold placed');
          this.showHoldDialog.set(false);
          this.saving.set(false);
          this.loadCreditStatus();
          this.creditChanged.emit();
        },
        error: () => this.saving.set(false),
      });
  }

  protected releaseHold(): void {
    this.saving.set(true);
    this.customerService.releaseCreditHold(this.customerId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.success('Credit hold released');
          this.saving.set(false);
          this.loadCreditStatus();
          this.creditChanged.emit();
        },
        error: () => this.saving.set(false),
      });
  }

  protected riskClass(risk: CreditRisk): string {
    switch (risk) {
      case 'Low': return 'success';
      case 'Medium': return 'warning';
      case 'High': return 'error';
      case 'OnHold': return 'error';
    }
  }

  protected barWidth(credit: CreditStatus): number {
    return Math.min(credit.utilizationPercent, 100);
  }

  private loadCreditStatus(): void {
    this.loading.set(true);
    this.customerService.getCreditStatus(this.customerId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.credit.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
