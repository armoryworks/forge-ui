import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ExpensesService } from '../../../expenses/services/expenses.service';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

@Component({
  selector: 'app-expense-settings-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    CurrencyInputComponent, InputComponent, ToggleComponent, LoadingBlockDirective, ValidationButtonComponent,
  ],
  templateUrl: './expense-settings-panel.component.html',
  styleUrl: './expense-settings-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseSettingsPanelComponent {
  private readonly expensesService = inject(ExpensesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    allowSelfApproval: new FormControl<boolean>(false, { nonNullable: true }),
    autoApproveThreshold: new FormControl<number | null>(null, [Validators.min(0.01)]),
    maxAmount: new FormControl<number | null>(null, [Validators.min(0.01)]),
    requireReceipt: new FormControl<boolean>(false, { nonNullable: true }),
    minDescriptionLength: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(500)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    autoApproveThreshold: this.translate.instant('expenseSettings.autoApproveThreshold'),
    maxAmount: this.translate.instant('expenseSettings.maxAmount'),
    minDescriptionLength: this.translate.instant('expenseSettings.minDescriptionLength'),
  });

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    this.loading.set(true);
    this.expensesService.getSettings().subscribe({
      next: (settings) => {
        this.form.patchValue({
          allowSelfApproval: settings.allowSelfApproval,
          autoApproveThreshold: settings.autoApproveThreshold,
          maxAmount: settings.maxAmount,
          requireReceipt: settings.requireReceipt,
          minDescriptionLength: settings.minDescriptionLength ?? 0,
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected saveSettings(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    const max = val.maxAmount;
    const auto = val.autoApproveThreshold;
    if (max !== null && auto !== null && auto > max) {
      this.snackbar.error(this.translate.instant('expenseSettings.thresholdExceedsMax'));
      return;
    }

    this.saving.set(true);
    this.expensesService.updateSettings({
      allowSelfApproval: val.allowSelfApproval,
      autoApproveThreshold: val.autoApproveThreshold,
      maxAmount: val.maxAmount,
      requireReceipt: val.requireReceipt,
      minDescriptionLength: val.minDescriptionLength,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('expenseSettings.saved'));
      },
      error: () => this.saving.set(false),
    });
  }
}
