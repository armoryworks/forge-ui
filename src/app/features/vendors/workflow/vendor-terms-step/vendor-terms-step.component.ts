import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { PAYMENT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';

import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorService } from '../../services/vendor.service';

/**
 * Vendor workflow terms step — payment terms, minimum order amount,
 * per-vendor off-tier variance override, freeform notes. All optional;
 * no completion gate.
 */
@Component({
  selector: 'app-vendor-terms-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, TextareaComponent, CurrencyInputComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './vendor-terms-step.component.html',
  styleUrl: './vendor-terms-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorTermsStepComponent {
  private readonly vendorService = inject(VendorService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('terms');
  readonly componentName = input<string>('VendorTermsStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);
  protected readonly paymentTermsOptions = PAYMENT_TERMS_OPTIONS;

  protected readonly form = new FormGroup({
    paymentTerms: new FormControl<string>('', { nonNullable: true }),
    minOrderAmount: new FormControl<number | null>(null, [Validators.min(0)]),
    offTierVariancePct: new FormControl<number | null>(null, [Validators.min(0), Validators.max(100)]),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  constructor() {
    effect(() => {
      const vendor = this.entity() as VendorDetail | null;
      if (!vendor) return;
      this.form.patchValue({
        paymentTerms: vendor.paymentTerms ?? '',
        offTierVariancePct: vendor.offTierVariancePct,
        notes: vendor.notes ?? '',
      }, { emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        paymentTerms: this.translate.instant('vendors.workflow.terms.paymentTermsLabel'),
        minOrderAmount: this.translate.instant('vendors.workflow.terms.minOrderAmountLabel'),
        offTierVariancePct: this.translate.instant('vendors.workflow.terms.offTierVariancePctLabel'),
        notes: this.translate.instant('vendors.workflow.terms.notesLabel'),
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
      paymentTerms: value.paymentTerms || null,
      minOrderAmount: value.minOrderAmount,
      offTierVariancePct: value.offTierVariancePct,
      notes: value.notes.trim() || null,
    }).pipe(
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
        error: () => {
          this.saving.set(false);
          this.snackbar.error(this.translate.instant('vendors.workflow.terms.saveFailed'));
        },
      }),
    );
  }
}
