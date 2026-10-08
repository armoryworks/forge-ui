import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { CapabilityService } from '../../../../shared/services/capability.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';

import { CustomerAddressesClusterComponent } from '../../components/customer-clusters/customer-addresses-cluster.component';
import { CustomerDetail } from '../../models/customer-detail.model';

/**
 * Customer workflow addresses step. Optional. Embeds the same address
 * list + editor the customer detail page uses, scoped to the customer the
 * identity step created; each address saves through its own dialog, so the
 * step itself has nothing to persist on Continue.
 */
@Component({
  selector: 'app-customer-addresses-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, CustomerAddressesClusterComponent],
  templateUrl: './customer-addresses-step.component.html',
  styleUrl: './customer-addresses-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressesStepComponent {
  private readonly workflowService = inject(WorkflowService);
  private readonly capabilityService = inject(CapabilityService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('addresses');
  readonly componentName = input<string>('CustomerAddressesStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly customerId = computed<number | null>(
    () => this.entityId() ?? (this.entity() as CustomerDetail | null)?.id ?? null,
  );

  protected readonly addressesEnabled = computed(
    () => this.capabilityService.isEnabled('CAP-MD-CUSTOMER-ADDRESSES', true),
  );

  protected readonly form = new FormGroup({});

  constructor() {
    this.workflowService.registerStepForm(this.form, {}, () => this.save());
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    return of(null);
  }
}
