import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { phoneValidator } from '../../../../shared/validators/phone.validator';

import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorService } from '../../services/vendor.service';

/**
 * Materialization step for the vendor workflow. CompanyName is the only
 * hard gate (hasIdentity validator); contact / email / phone are
 * optional but commonly captured up-front. The first save against this
 * step calls VendorWorkflowAdapter.CreateDraftAsync which stamps the
 * underlying Vendor row — subsequent saves apply field patches to the
 * now-real entity.
 */
@Component({
  selector: 'app-vendor-identity-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, LoadingBlockDirective],
  templateUrl: './vendor-identity-step.component.html',
  styleUrl: './vendor-identity-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorIdentityStepComponent {
  private readonly vendorService = inject(VendorService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('identity');
  readonly componentName = input<string>('VendorIdentityStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    companyName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    contactName: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(256)] }),
    phone: new FormControl<string>('', { nonNullable: true, validators: [phoneValidator] }),
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
      }, { emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        companyName: this.translate.instant('vendors.workflow.identity.companyNameLabel'),
        contactName: this.translate.instant('vendors.workflow.identity.contactNameLabel'),
        email: this.translate.instant('vendors.workflow.identity.emailLabel'),
        phone: this.translate.instant('vendors.workflow.identity.phoneLabel'),
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
      companyName: value.companyName.trim(),
      contactName: value.contactName.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
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
          this.snackbar.error(this.translate.instant('vendors.workflow.identity.saveFailed'));
        },
      }),
    );
  }
}
