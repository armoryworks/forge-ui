import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';

import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/**
 * Vendor step — used by Subcontract combos (S1 / S2) to pick the
 * subcontract vendor that performs the operation. Lead time + per-vendor
 * terms live on the VendorPart row entered in the subsequent VendorParts
 * step; this step's only output is <c>preferredVendorId</c> on the Part.
 */
@Component({
  selector: 'app-part-vendor-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    EntityPickerComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-vendor-step.component.html',
  styleUrl: './part-vendor-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartVendorStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('vendor');
  readonly componentName = input<string>('PartVendorStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    preferredVendorId: new FormControl<number | null>(null),
  });

  private suppressDispatch = false;

  constructor() {
    effect(() => {
      const part = this.entity() as PartDetail | null;
      if (!part) return;
      this.suppressDispatch = true;
      this.form.patchValue({
        preferredVendorId: part.preferredVendorId ?? null,
      }, { emitEvent: false });
      this.suppressDispatch = false;
    });

    this.form.valueChanges
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.suppressDispatch) return;
        if (this.form.invalid) return;
        this.dispatchSave();
      });
  }

  private dispatchSave(): void {
    const runId = this.runId();
    if (runId == null) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.workflowService.patchStep(runId, this.stepId(), {
      preferredVendorId: value.preferredVendorId ?? null,
    }).subscribe({
      next: (run) => {
        this.saving.set(false);
        if (run.entityId == null) return;
        this.partsService.getPartById(run.entityId).subscribe({
          next: (detail) => this.workflowService.currentEntity.set(detail),
        });
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('parts.workflow.vendor.saveFailed'));
      },
    });
  }
}
