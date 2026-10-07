import { ChangeDetectionStrategy, Component, inject, output, Signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

@Component({
  selector: 'app-price-override-reason-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './price-override-reason-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceOverrideReasonDialogComponent {
  private readonly translate = inject(TranslateService);

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup({
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }),
  });

  protected readonly violations: Signal<string[]> = FormValidationService.getViolations(this.form, {
    reason: this.translate.instant('purchaseOrders.priceChangeReason'),
  });

  protected confirm(): void {
    const reason = this.form.controls.reason.value.trim();
    if (!reason) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirmed.emit(reason);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
