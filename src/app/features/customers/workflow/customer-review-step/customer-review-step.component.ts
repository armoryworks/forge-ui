import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { WorkflowService } from '../../../../shared/services/workflow.service';

import { CustomerDetail } from '../../models/customer-detail.model';

/**
 * Customer workflow review step. Read-only summary of the live entity
 * before the admin hits Mark Complete. The workflow definition's
 * completionGates re-asserts hasIdentity so the server-side gate check
 * still runs at completeRun time.
 */
@Component({
  selector: 'app-customer-review-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './customer-review-step.component.html',
  styleUrl: './customer-review-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReviewStepComponent {
  private readonly workflowService = inject(WorkflowService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('review');
  readonly componentName = input<string>('CustomerReviewStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly form = new FormGroup({});
  protected readonly customer = computed<CustomerDetail | null>(
    () => this.entity() as CustomerDetail | null,
  );

  constructor() {
    this.workflowService.registerStepForm(this.form, {}, () => this.save());
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    return of(null);
  }
}
