import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, map, of, switchMap, tap } from 'rxjs';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { phoneValidator } from '../../../../shared/validators/phone.validator';

import { CustomerDetail } from '../../models/customer-detail.model';
import { CustomerService } from '../../services/customer.service';
import { CUSTOMER_COMMERCIAL_TERMS_ROLES } from '../../customer-roles';

/**
 * Express-mode form for the customer workflow. Single consolidated screen
 * with identity + credit/tax (the two scalar concerns); addresses still
 * defer to the customer detail page post-creation. Patches the
 * materialization step so every field lands in one save.
 */
@Component({
  selector: 'app-customer-express-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, CurrencyInputComponent,
    LoadingBlockDirective, ValidationButtonComponent,
  ],
  templateUrl: './customer-express-form.component.html',
  styleUrl: './customer-express-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerExpressFormComponent {
  private readonly customerService = inject(CustomerService);
  private readonly activeCurrencies = inject(ActiveCurrencyService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly stepId = input<string>('express');
  readonly componentName = input<string>('CustomerExpressFormComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);
  protected readonly canSetCommercialTerms = this.auth.hasAnyRole(CUSTOMER_COMMERCIAL_TERMS_ROLES);

  /** Gated by the `customers.allow_manual_numbers` system setting. Optional here —
   *  a blank value lets the server auto-generate the number. */
  protected readonly allowManualCustomerNumbers = computed(() => this.manualNumberSettings.isEnabled('customers'));

  private readonly fallbackCurrencyOptions: SelectOption[] = [
    { value: 'USD', label: this.translate.instant('leads.convertStepper.currencyUSD') },
    { value: 'EUR', label: this.translate.instant('leads.convertStepper.currencyEUR') },
    { value: 'GBP', label: this.translate.instant('leads.convertStepper.currencyGBP') },
    { value: 'CAD', label: this.translate.instant('leads.convertStepper.currencyCAD') },
    { value: 'MXN', label: this.translate.instant('leads.convertStepper.currencyMXN') },
  ];
  protected readonly currencyOptions = signal<SelectOption[]>(this.fallbackCurrencyOptions);

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    customerNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    companyName: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(256)] }),
    phone: new FormControl<string>('', { nonNullable: true, validators: [phoneValidator] }),
    creditLimit: new FormControl<number | null>(null, [Validators.min(0)]),
    defaultCurrency: new FormControl<string>('USD', { nonNullable: true }),
    isTaxExempt: new FormControl<boolean>(false, { nonNullable: true }),
    taxExemptionId: new FormControl<string>('', { nonNullable: true }),
  });

  private readonly violationLabels: Record<string, string> = {
    name: this.translate.instant('guidedSetup.customerIdentity.nameLabel'),
    customerNumber: this.translate.instant('customers.customerNumberLabel'),
    companyName: this.translate.instant('guidedSetup.customerIdentity.displayNameLabel'),
    email: this.translate.instant('customers.workflow.identity.emailLabel'),
    phone: this.translate.instant('customers.workflow.identity.phoneLabel'),
    creditLimit: this.translate.instant('customers.workflow.creditAndTax.creditLimitLabel'),
    defaultCurrency: this.translate.instant('customers.workflow.creditAndTax.defaultCurrencyLabel'),
    isTaxExempt: this.translate.instant('customers.workflow.creditAndTax.isTaxExemptLabel'),
    taxExemptionId: this.translate.instant('customers.workflow.creditAndTax.taxExemptionIdLabel'),
  };
  protected readonly violations = FormValidationService.getViolations(this.form, this.violationLabels);

  constructor() {
    this.activeCurrencies.listActiveCurrencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(list => {
      if (list.length > 0) this.currencyOptions.set(list.map(c => ({ value: c.code, label: `${c.code} — ${c.name}` })));
    });
    effect(() => {
      const customer = this.entity() as CustomerDetail | null;
      if (!customer) return;
      this.form.patchValue({
        name: customer.name ?? '',
        customerNumber: customer.customerNumber ?? '',
        companyName: customer.companyName ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        creditLimit: customer.creditLimit ?? null,
        defaultCurrency: customer.defaultCurrency ?? 'USD',
        isTaxExempt: customer.isTaxExempt ?? false,
        taxExemptionId: customer.taxExemptionId ?? '',
      }, { emitEvent: false });
    });

    this.form.controls.isTaxExempt.valueChanges.subscribe(isExempt => {
      const ctrl = this.form.controls.taxExemptionId;
      if (isExempt) ctrl.addValidators(Validators.required);
      else { ctrl.removeValidators(Validators.required); ctrl.setValue(''); }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      this.violationLabels,
      () => this.persistOnly(),
    );
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const runId = this.runId();
    if (runId == null) return;
    const knownEntityId = this.entityId();
    const needsPatch = this.form.dirty || knownEntityId == null;
    this.saving.set(true);
    const persisted$: Observable<number | null> = needsPatch
      ? this.workflowService.patchStep(runId, 'identity', this.fieldsFromForm()).pipe(
        tap(() => this.form.markAsPristine()),
        map((run) => run.entityId),
      )
      : of(knownEntityId);
    persisted$.pipe(
      switchMap((entityId) => this.workflowService.completeRun(runId).pipe(
        map((result) => ({ entityId: result.success ? (result.run.entityId ?? entityId) : entityId, result })),
      )),
    ).subscribe({
      next: ({ entityId, result }) => {
        this.saving.set(false);
        if (!result.success) {
          const missing = result.missing
            .map((m) => this.translate.instant(m.missingMessageKey ?? m.displayNameKey))
            .join('; ');
          this.snackbar.error(this.translate.instant('customers.workflow.page.missingValidators', { missing }));
          return;
        }
        const target = entityId != null ? ['/customers', entityId, 'overview'] : ['/customers'];
        this.router.navigate(target).then(() =>
          this.snackbar.success(this.translate.instant('customers.workflow.page.completeSuccess')));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'customers.workflow.express.saveFailed');
      },
    });
  }

  private persistOnly(): Observable<unknown> {
    const runId = this.runId();
    if (runId == null) return of(null);
    if (this.form.pristine) return of(null);
    this.saving.set(true);
    return this.workflowService.patchStep(runId, 'identity', this.fieldsFromForm()).pipe(
      switchMap((run) => {
        if (run.entityId == null) return of(null);
        return this.customerService.getCustomerById(run.entityId).pipe(
          tap((customer) => this.workflowService.currentEntity.set(customer)),
        );
      }),
      tap({
        next: () => { this.saving.set(false); this.form.markAsPristine(); },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snackbar.errorFrom(err, 'customers.workflow.express.saveFailed');
        },
      }),
    );
  }

  private fieldsFromForm(): Record<string, unknown> {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      customerNumber: this.allowManualCustomerNumbers() ? (value.customerNumber.trim() || null) : null,
      companyName: value.companyName.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      creditLimit: value.creditLimit,
      defaultCurrency: value.defaultCurrency || null,
      isTaxExempt: value.isTaxExempt,
      taxExemptionId: value.isTaxExempt ? (value.taxExemptionId.trim() || null) : null,
    };
  }
}
