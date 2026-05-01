import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/**
 * Pillar 6 follow-up — Manufacturer step. Captures the engineering OEM
 * identity (manufacturer name + manufacturer part number + external part
 * number) — distinct from the distributor we buy through, which lives on
 * the Sources tab.
 */
@Component({
  selector: 'app-part-manufacturer-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-manufacturer-step.component.html',
  styleUrl: './part-manufacturer-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartManufacturerStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('manufacturer');
  readonly componentName = input<string>('PartManufacturerStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    manufacturerName: new FormControl<string>('', [Validators.maxLength(200)]),
    manufacturerPartNumber: new FormControl<string>('', [Validators.maxLength(100)]),
    externalPartNumber: new FormControl<string>('', [Validators.maxLength(100)]),
  });

  private suppressDispatch = false;

  constructor() {
    effect(() => {
      const part = this.entity() as PartDetail | null;
      if (!part) return;
      this.suppressDispatch = true;
      this.form.patchValue({
        manufacturerName: part.manufacturerName ?? '',
        manufacturerPartNumber: part.manufacturerPartNumber ?? '',
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
      manufacturerName: value.manufacturerName || undefined,
      manufacturerPartNumber: value.manufacturerPartNumber || undefined,
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
        this.snackbar.error(this.translate.instant('parts.workflow.manufacturer.saveFailed'));
      },
    });
  }
}
