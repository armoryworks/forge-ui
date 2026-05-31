import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
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
    LoadingBlockDirective,
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

  readonly stepId = input<string>('express');
  readonly componentName = input<string>('VendorExpressFormComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);
  protected readonly paymentTermsOptions = PAYMENT_TERMS_OPTIONS;

  protected readonly form = new FormGroup({
    companyName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    contactName: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(256)] }),
    phone: new FormControl<string>('', { nonNullable: true, validators: [phoneValidator] }),
    paymentTerms: new FormControl<string>('', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  constructor() {
    effect(() => {
      const vendor = this.entity() as VendorDetail | null;
      if (!vendor) return;
      this.form.patchValue({
        companyName: vendor.companyName ?? '',
        contactName: vendor.contactName ?? '',
        email: vendor.email ?? '',
        phone: vendor.phone ?? '',
        paymentTerms: vendor.paymentTerms ?? '',
        notes: vendor.notes ?? '',
      }, { emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        companyName: this.translate.instant('vendors.workflow.identity.companyNameLabel'),
        contactName: this.translate.instant('vendors.workflow.identity.contactNameLabel'),
        email: this.translate.instant('vendors.workflow.identity.emailLabel'),
        phone: this.translate.instant('vendors.workflow.identity.phoneLabel'),
        paymentTerms: this.translate.instant('vendors.workflow.terms.paymentTermsLabel'),
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
    // Express patch targets the workflow's first step (identity) — the
    // patch endpoint applies every field on the entity regardless of which
    // step "owns" it. This matches PartExpressFormComponent's shape.
    return this.workflowService.patchStep(runId, 'identity', {
      companyName: value.companyName.trim(),
      contactName: value.contactName.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      paymentTerms: value.paymentTerms || null,
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
          this.snackbar.error(this.translate.instant('vendors.workflow.express.saveFailed'));
        },
      }),
    );
  }
}
