import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerSummary } from '../../models/customer-summary.model';
import { UpdateCustomerRequest } from '../../models/update-customer-request.model';
import { CustomerService } from '../../services/customer.service';

/** The customer's over/under shipment tolerance; blank fields fall back to the company default. */
@Component({
  selector: 'app-ship-tolerance-card',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './ship-tolerance-card.component.html',
  styleUrl: './ship-tolerance-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipToleranceCardComponent {
  private readonly service = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly customer = input.required<CustomerSummary>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    over: new FormControl<number | null>(null, [Validators.min(0), Validators.max(999.99)]),
    under: new FormControl<number | null>(null, [Validators.min(0), Validators.max(100)]),
  });

  constructor() {
    effect(() => {
      const c = this.customer();
      this.form.reset({ over: c.overShipTolerancePct ?? null, under: c.underShipTolerancePct ?? null });
    });
  }

  protected save(): void {
    if (this.form.invalid || this.form.pristine) return;
    const { over, under } = this.form.getRawValue();
    const request: UpdateCustomerRequest = {
      ...(over != null ? { overShipTolerancePct: over } : { clearOverShipTolerance: true }),
      ...(under != null ? { underShipTolerancePct: under } : { clearUnderShipTolerance: true }),
    };
    this.saving.set(true);
    this.service.updateCustomer(this.customer().id, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.snackbar.success(this.translate.instant('tolerance.saved'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
