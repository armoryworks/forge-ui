import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, map, of, switchMap, tap } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { PAYMENT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { phoneValidator } from '../../../../shared/validators/phone.validator';

import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorService } from '../../services/vendor.service';

/**
 * Express-mode form for the vendor workflow. Single consolidated screen
 * surfacing the most-commonly-captured fields (identity + payment terms +
 * notes) without the step rail. Address can still be added later from
 * the vendor detail page; the express form intentionally skips it so the
 * one-shot flow stays under ~30 seconds to fill.
 */
@Component({
  selector: 'app-vendor-express-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, TextareaComponent,
    LoadingBlockDirective, ValidationButtonComponent,
  ],
  templateUrl: './vendor-express-form.component.html',
  styleUrl: './vendor-express-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorExpressFormComponent {
  private readonly vendorService = inject(VendorService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly router = inject(Router);

  readonly stepId = input<string>('express');
  readonly componentName = input<string>('VendorExpressFormComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);
  protected readonly allowManualVendorNumbers = computed(() => this.manualNumberSettings.isEnabled('vendors'));
  protected readonly paymentTermsOptions = PAYMENT_TERMS_OPTIONS;

  protected readonly form = new FormGroup({
    companyName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    vendorNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    contactName: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(256)] }),
    phone: new FormControl<string>('', { nonNullable: true, validators: [phoneValidator] }),
    paymentTerms: new FormControl<string>('', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  private readonly violationLabels: Record<string, string> = {
    companyName: this.translate.instant('vendors.workflow.identity.companyNameLabel'),
    vendorNumber: this.translate.instant('vendors.vendorNumberLabel'),
    contactName: this.translate.instant('vendors.workflow.identity.contactNameLabel'),
    email: this.translate.instant('vendors.workflow.identity.emailLabel'),
    phone: this.translate.instant('vendors.workflow.identity.phoneLabel'),
    paymentTerms: this.translate.instant('vendors.workflow.terms.paymentTermsLabel'),
    notes: this.translate.instant('vendors.workflow.terms.notesLabel'),
  };
  protected readonly violations = FormValidationService.getViolations(this.form, this.violationLabels);

  constructor() {
    effect(() => {
      const vendor = this.entity() as VendorDetail | null;
      if (!vendor) return;
      this.form.patchValue({
        companyName: vendor.companyName ?? '',
        vendorNumber: vendor.vendorNumber ?? '',
        contactName: vendor.contactName ?? '',
        email: vendor.email ?? '',
        phone: vendor.phone ?? '',
        paymentTerms: vendor.paymentTerms ?? '',
        notes: vendor.notes ?? '',
      }, { emitEvent: false });
      this.workflowService.refreshStepForm();
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
          this.snackbar.error(this.translate.instant('vendors.workflow.page.missingValidators', { missing }));
          return;
        }
        const extras = entityId != null ? { queryParams: { detail: `vendor:${entityId}` } } : {};
        this.router.navigate(['/vendors'], extras).then(() =>
          this.snackbar.success(this.translate.instant('guidedSetup.vendorCreated')));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'vendors.workflow.express.saveFailed');
      },
    });
  }

  private persistOnly(): Observable<unknown> {
    const runId = this.runId();
    if (runId == null) return of(null);
    if (this.form.pristine) return of(null);
    this.saving.set(true);
    // Express patch targets the workflow's first step (identity) — the
    // patch endpoint applies every field on the entity regardless of which
    // step "owns" it. This matches PartExpressFormComponent's shape.
    return this.workflowService.patchStep(runId, 'identity', this.fieldsFromForm()).pipe(
      switchMap((run) => {
        if (run.entityId == null) return of(null);
        return this.vendorService.getVendorById(run.entityId).pipe(
          tap((vendor) => this.workflowService.currentEntity.set(vendor)),
        );
      }),
      tap({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snackbar.errorFrom(err, 'vendors.workflow.express.saveFailed');
        },
      }),
    );
  }

  private fieldsFromForm(): Record<string, unknown> {
    const value = this.form.getRawValue();
    return {
      companyName: value.companyName.trim(),
      vendorNumber: this.allowManualVendorNumbers() ? (value.vendorNumber.trim() || null) : null,
      contactName: value.contactName.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      paymentTerms: value.paymentTerms || null,
      notes: value.notes.trim() || null,
    };
  }
}
