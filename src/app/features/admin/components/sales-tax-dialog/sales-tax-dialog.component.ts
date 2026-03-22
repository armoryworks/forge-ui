import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { SalesTaxRate } from '../../models/sales-tax-rate.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-sales-tax-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, ToggleComponent, TextareaComponent,
    ValidationPopoverDirective, TranslatePipe,
  ],
  templateUrl: './sales-tax-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTaxDialogComponent {
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly rate = input<SalesTaxRate | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    code: new FormControl('', [Validators.required, Validators.maxLength(20)]),
    ratePercent: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    isDefault: new FormControl(false),
    description: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name',
    code: 'Code',
    ratePercent: 'Rate (%)',
  });

  constructor() {
    const r = this.rate();
    if (r) {
      this.form.patchValue({
        name: r.name,
        code: r.code,
        ratePercent: parseFloat((r.rate * 100).toFixed(4)),
        isDefault: r.isDefault,
        description: r.description ?? '',
      });
    }
  }

  protected get isEditing(): boolean {
    return this.rate() !== null;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const payload = {
      name: f.name!,
      code: f.code!,
      rate: (f.ratePercent ?? 0) / 100,
      isDefault: f.isDefault ?? false,
      description: f.description || null,
    };

    const r = this.rate();
    const call = r
      ? this.adminService.updateSalesTaxRate(r.id, payload)
      : this.adminService.createSalesTaxRate(payload);

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(r ? 'salesTax.updated' : 'salesTax.created'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
