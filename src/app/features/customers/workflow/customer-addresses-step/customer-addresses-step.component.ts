import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { WorkflowService } from '../../../../shared/services/workflow.service';

/**
 * Customer workflow addresses step. V1 stub — same shape as the vendor
 * supply-items step. Customer.Addresses is a collection entity
 * (CustomerAddress), so billing + shipping mutations are deferred to
 * the customer detail page's Addresses tab where the dedicated endpoints
 * exist. The legacy guided-customer-dialog bundled them into the create
 * payload; the new flow creates the Customer first and lets the admin
 * add addresses afterward.
 */
@Component({
  selector: 'app-customer-addresses-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './customer-addresses-step.component.html',
  styleUrl: './customer-addresses-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressesStepComponent {
  private readonly workflowService = inject(WorkflowService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('addresses');
  readonly componentName = input<string>('CustomerAddressesStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly form = new FormGroup({});

  constructor() {
    this.workflowService.registerStepForm(this.form, {}, () => this.save());
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    return of(null);
  }
}
