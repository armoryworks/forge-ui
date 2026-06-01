import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { WorkflowService } from '../../../../shared/services/workflow.service';

/**
 * Vendor workflow supply-items step. V1 stub: directs the admin to add
 * VendorPart drafts from the vendor's detail page after creation. The
 * legacy guided-vendor-dialog kept an in-memory list and committed it
 * post-vendor-create — that pattern doesn't fit the workflow framework's
 * patchStep model cleanly (collection mutations would need a dedicated
 * endpoint per item). Migrating that flow to a proper /vendors/{id}/parts
 * endpoint is a follow-up; for now the workflow lets the admin proceed
 * without supply items and surfaces a clear "do this later" message.
 */
@Component({
  selector: 'app-vendor-supply-items-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './vendor-supply-items-step.component.html',
  styleUrl: './vendor-supply-items-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorSupplyItemsStepComponent {
  private readonly workflowService = inject(WorkflowService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('supplyItems');
  readonly componentName = input<string>('VendorSupplyItemsStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  // Pristine no-op form — the step has no required fields. Registering
  // anyway so the shell's Continue gate sees a "valid empty" form and
  // can pass through.
  protected readonly form = new FormGroup({});

  constructor() {
    this.workflowService.registerStepForm(this.form, {}, () => this.save());
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    // Nothing to persist today — the step is informational only.
    return of(null);
  }
}
