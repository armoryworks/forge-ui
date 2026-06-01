import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { WorkflowService } from '../../../../shared/services/workflow.service';

import { VendorDetail } from '../../models/vendor-detail.model';

/**
 * Vendor workflow review step. Read-only summary so the admin can scan
 * the final state before hitting Mark Complete. Pulls live values from
 * the shell's <c>entity</c> input — every prior step has already
 * persisted, so this just renders what's on the row.
 *
 * Re-asserts the hasIdentity gate via the definition's completionGates;
 * completeRun's server-side gate check will block if companyName has
 * somehow been cleared by the time the user lands here.
 */
@Component({
  selector: 'app-vendor-review-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './vendor-review-step.component.html',
  styleUrl: './vendor-review-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorReviewStepComponent {
  private readonly workflowService = inject(WorkflowService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('review');
  readonly componentName = input<string>('VendorReviewStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly form = new FormGroup({});

  protected readonly vendor = computed<VendorDetail | null>(
    () => this.entity() as VendorDetail | null,
  );

  protected readonly addressLine = computed(() => {
    const v = this.vendor();
    if (!v) return '';
    const parts = [v.address, v.city, v.state, v.zipCode, v.country].filter(Boolean);
    return parts.join(', ');
  });

  constructor() {
    this.workflowService.registerStepForm(this.form, {}, () => this.save());
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    return of(null);
  }
}
