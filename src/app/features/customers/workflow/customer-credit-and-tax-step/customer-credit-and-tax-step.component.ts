import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';

import { CustomerDetail } from '../../models/customer-detail.model';
import { CustomerService } from '../../services/customer.service';

/**
 * Customer workflow credit + tax step. Optional — no completion gate.
 * TaxExemptionId becomes conditionally required when isTaxExempt is true.
 */
@Component({
  selector: 'app-customer-credit-and-tax-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, CurrencyInputComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './customer-credit-and-tax-step.component.html',
  styleUrl: './customer-credit-and-tax-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerCreditAndTaxStepComponent {
  private readonly customerService = inject(CustomerService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('creditAndTax');
  readonly componentName = input<string>('CustomerCreditAndTaxStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  // Same shape the legacy guided dialog offered. Currency options live in
  // the leads.convertStepper i18n bucket (legacy) — re-used here rather
  // than duplicating keys for the same five ISO 4217 codes.
  protected readonly currencyOptions: SelectOption[] = [
    { value: 'USD', label: this.translate.instant('leads.convertStepper.currencyUSD') },
    { value: 'EUR', label: this.translate.instant('leads.convertStepper.currencyEUR') },
    { value: 'GBP', label: this.translate.instant('leads.convertStepper.currencyGBP') },
    { value: 'CAD', label: this.translate.instant('leads.convertStepper.currencyCAD') },
    { value: 'MXN', label: this.translate.instant('leads.convertStepper.currencyMXN') },
  ];

  protected readonly form = new FormGroup({
    creditLimit: new FormControl<number | null>(null, [Validators.min(0)]),
    defaultCurrency: new FormControl<string>('USD', { nonNullable: true }),
    isTaxExempt: new FormControl<boolean>(false, { nonNullable: true }),
    taxExemptionId: new FormControl<string>('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const customer = this.entity() as CustomerDetail | null;
      if (!customer) return;
      this.form.patchValue({
        creditLimit: customer.creditLimit ?? null,
        defaultCurrency: customer.defaultCurrency ?? 'USD',
        isTaxExempt: customer.isTaxExempt ?? false,
        taxExemptionId: customer.taxExemptionId ?? '',
      }, { emitEvent: false });
    });

    // Conditional required: TaxExemptionId is required when isTaxExempt is
    // true. Mirrors the legacy dialog's behavior.
    this.form.controls.isTaxExempt.valueChanges.subscribe(isExempt => {
      const ctrl = this.form.controls.taxExemptionId;
      if (isExempt) ctrl.addValidators(Validators.required);
      else { ctrl.removeValidators(Validators.required); ctrl.setValue(''); }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        creditLimit: this.translate.instant('customers.workflow.creditAndTax.creditLimitLabel'),
        defaultCurrency: this.translate.instant('customers.workflow.creditAndTax.defaultCurrencyLabel'),
        isTaxExempt: this.translate.instant('customers.workflow.creditAndTax.isTaxExemptLabel'),
        taxExemptionId: this.translate.instant('customers.workflow.creditAndTax.taxExemptionIdLabel'),
      },
      () => this.save(),
    );
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    const runId = this.runId();
    if (runId == null) return of(null);
    if (this.form.pristine) return of(null);
    const value = this.form.getRawValue();
    this.saving.set(true);
    return this.workflowService.patchStep(runId, this.stepId(), {
      creditLimit: value.creditLimit,
      defaultCurrency: value.defaultCurrency || null,
      isTaxExempt: value.isTaxExempt,
      taxExemptionId: value.isTaxExempt ? (value.taxExemptionId.trim() || null) : null,
    }).pipe(
      switchMap((run) => {
        if (run.entityId == null) return of(null);
        return this.customerService.getCustomerById(run.entityId).pipe(
          tap((customer) => this.workflowService.currentEntity.set(customer)),
        );
      }),
      tap({
        next: () => { this.saving.set(false); this.form.markAsPristine(); },
        error: () => {
          this.saving.set(false);
          this.snackbar.error(this.translate.instant('customers.workflow.creditAndTax.saveFailed'));
        },
      }),
    );
  }
}
