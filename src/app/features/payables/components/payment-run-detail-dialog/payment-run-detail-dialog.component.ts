import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PaymentRunService } from '../../services/payment-run.service';
import { PaymentRunDetail } from '../../models/payment-run-detail.model';
import { PaymentRunDetailDialogData } from '../../models/payment-run-detail-dialog-data.model';
import { vendorCreditStatusChip } from '../../vendor-credit-status';
import { PAYABLES_MANAGE_ROLES } from '../../payables-roles';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

/** A payment run's bills with what each became: paid (and by which payment), failed with the reason, or pending. */
@Component({
  selector: 'app-payment-run-detail-dialog',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe, DateOnlyPipe, CurrencyDisplayComponent, LoadingBlockDirective],
  templateUrl: './payment-run-detail-dialog.component.html',
  styleUrl: './payment-run-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentRunDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<PaymentRunDetailDialogComponent, boolean>);
  private readonly service = inject(PaymentRunService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly data = inject<PaymentRunDetailDialogData>(MAT_DIALOG_DATA);
  protected readonly canManage = inject(AuthService).hasAnyRole(PAYABLES_MANAGE_ROLES);
  protected readonly run = signal<PaymentRunDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);

  private hasUpdated = false;

  constructor() {
    this.loading.set(true);
    this.service.getById(this.data.runId).subscribe({
      next: run => {
        this.run.set(run);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close(this.hasUpdated);
  }

  protected statusClass(status: string): string {
    return vendorCreditStatusChip(status);
  }

  protected resume(): void {
    const run = this.run();
    if (!run || this.busy()) return;
    this.busy.set(true);
    this.service.resume(run.id).subscribe({
      next: resumed => {
        this.run.set(resumed);
        this.busy.set(false);
        this.hasUpdated = true;
        this.snackbar.success(this.translate.instant(resumed.status === 'Completed' ? 'paymentRuns.resumed' : 'paymentRuns.stillInterrupted',
          { number: resumed.runNumber }));
      },
      error: () => this.busy.set(false),
    });
  }
}
