import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { phoneValidator } from '../../../../shared/validators/phone.validator';

import { CustomerDetail } from '../../models/customer-detail.model';
import { CustomerService } from '../../services/customer.service';

/**
 * Materialization step for the customer workflow. Name is the only hard
 * gate (hasIdentity validator); CompanyName / Email / Phone are common
 * captures. The first save calls CustomerWorkflowAdapter.CreateDraftAsync
 * which stamps the underlying Customer row.
 */
@Component({
  selector: 'app-customer-identity-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, LoadingBlockDirective],
  templateUrl: './customer-identity-step.component.html',
  styleUrl: './customer-identity-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerIdentityStepComponent {
  private readonly customerService = inject(CustomerService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('identity');
  readonly componentName = input<string>('CustomerIdentityStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    companyName: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(256)] }),
    phone: new FormControl<string>('', { nonNullable: true, validators: [phoneValidator] }),
  });

  constructor() {
    effect(() => {
      const customer = this.entity() as CustomerDetail | null;
      if (!customer) return;
      this.form.patchValue({
        name: customer.name ?? '',
        companyName: customer.companyName ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
      }, { emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        name: this.translate.instant('customers.workflow.identity.nameLabel'),
        companyName: this.translate.instant('customers.workflow.identity.companyNameLabel'),
        email: this.translate.instant('customers.workflow.identity.emailLabel'),
        phone: this.translate.instant('customers.workflow.identity.phoneLabel'),
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
      name: value.name.trim(),
      companyName: value.companyName.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
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
          this.snackbar.error(this.translate.instant('customers.workflow.identity.saveFailed'));
        },
      }),
    );
  }
}
