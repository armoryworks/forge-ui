import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';

import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/**
 * Pillar 6 follow-up — Sourcing step. Used by Buy* and Subcontract* combos
 * to capture the default-vendor block: preferred vendor, lead time, MOQ,
 * pack size, and external part number. Per-vendor overrides happen on the
 * Sources tab.
 */
@Component({
  selector: 'app-part-sourcing-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, EntityPickerComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-sourcing-step.component.html',
  styleUrl: './part-sourcing-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartSourcingStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('sourcing');
  readonly componentName = input<string>('PartSourcingStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    preferredVendorId: new FormControl<number | null>(null),
    leadTimeDays: new FormControl<number | null>(null, [Validators.min(0)]),
    minOrderQty: new FormControl<number | null>(null, [Validators.min(0)]),
    packSize: new FormControl<number | null>(null, [Validators.min(0)]),
    externalPartNumber: new FormControl<string>('', [Validators.maxLength(100)]),
  });

  private suppressDispatch = false;

  constructor() {
    effect(() => {
      const part = this.entity() as PartDetail | null;
      if (!part) return;
      this.suppressDispatch = true;
      this.form.patchValue({
        preferredVendorId: part.preferredVendorId ?? null,
        leadTimeDays: part.leadTimeDays ?? null,
        minOrderQty: part.minimumOrderQuantity ?? null,
        packSize: part.orderMultiple ?? null,
        externalPartNumber: part.externalPartNumber ?? '',
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
      leadTimeDays: value.leadTimeDays ?? null,
      minimumOrderQuantity: value.minOrderQty ?? null,
      orderMultiple: value.packSize ?? null,
      externalPartNumber: value.externalPartNumber || undefined,
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
        this.snackbar.error(this.translate.instant('parts.workflow.sourcing.saveFailed'));
      },
    });
  }
}
