import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe } from '@ngx-translate/core';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CostingQuickStartResult } from '../../models/costing.model';
import { CostingService } from '../../services/costing.service';

/**
 * Prepackaged costing setup: a few answers (headcount, wages, burden, utilities,
 * facilities, equipment) populate the plant cost center, the fiscal-year period,
 * the standard overhead pools with budgets, and — when full GL is on — the
 * matching GL expense accounts + budget lines. Closes with the applied result.
 */
@Component({
  selector: 'app-costing-quick-start-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    CurrencyInputComponent,
    DialogComponent,
    InputComponent,
    ToggleComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './costing-quick-start-dialog.component.html',
  styleUrl: './costing-quick-start-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostingQuickStartDialogComponent {
  private readonly ref = inject(MatDialogRef<CostingQuickStartDialogComponent, CostingQuickStartResult | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CostingService);

  protected readonly saving = signal(false);
  protected readonly error = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    fiscalYear: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    directHeadcount: [null as number | null, [Validators.required, Validators.min(0.5)]],
    averageHourlyWage: [null as number | null, [Validators.required, Validators.min(0.01)]],
    payrollTaxPercent: [7.65, [Validators.required, Validators.min(0), Validators.max(100)]],
    benefitsMonthlyPerEmployee: [0, [Validators.min(0)]],
    utilitiesMonthly: [0, [Validators.min(0)]],
    facilitiesMonthly: [0, [Validators.min(0)]],
    equipmentAnnual: [0, [Validators.min(0)]],
    createGlBudgets: [true],
    setDefaultLaborRates: [false],
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    fiscalYear: 'Fiscal year',
    directHeadcount: 'Direct headcount',
    averageHourlyWage: 'Average hourly wage',
    payrollTaxPercent: 'Payroll tax %',
    benefitsMonthlyPerEmployee: 'Benefits / employee / month',
    utilitiesMonthly: 'Utilities / month',
    facilitiesMonthly: 'Facilities / month',
    equipmentAnnual: 'Equipment / year',
  });

  protected apply(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(false);
    const v = this.form.getRawValue();
    this.service
      .applyQuickStart({
        fiscalYear: v.fiscalYear,
        directHeadcount: v.directHeadcount!,
        averageHourlyWage: v.averageHourlyWage!,
        payrollTaxPercent: v.payrollTaxPercent,
        benefitsMonthlyPerEmployee: v.benefitsMonthlyPerEmployee,
        utilitiesMonthly: v.utilitiesMonthly,
        facilitiesMonthly: v.facilitiesMonthly,
        equipmentAnnual: v.equipmentAnnual,
        createGlBudgets: v.createGlBudgets,
        setDefaultLaborRates: v.setDefaultLaborRates,
      })
      .subscribe({
        next: (result) => this.ref.close(result),
        error: () => {
          this.saving.set(false);
          this.error.set(true);
        },
      });
  }

  protected cancel(): void {
    this.ref.close();
  }
}
