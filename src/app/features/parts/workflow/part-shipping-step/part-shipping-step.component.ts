import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import {
  fromCanonicalMeasure, measureDisplayUnit, measureUnitOptions, toCanonicalMeasure,
} from '../../../../shared/utils/measure-units';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/**
 * Pillar 6 follow-up — Shipping step. Captures the measurement profile
 * (mass, dimensions, volume) used for shipping rate quotes and inventory
 * cube calculations. Persists in canonical SI (grams / mm / mL) with a
 * per-field display unit so the user can type whichever unit they prefer.
 *
 * Conversion math is the shared `measure-units` util, as in `PartMaterialClusterComponent`.
 *
 * Save model: explicit save-on-Continue (registered with WorkflowService).
 */
@Component({
  selector: 'app-part-shipping-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-shipping-step.component.html',
  styleUrl: './part-shipping-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartShippingStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('shipping');
  readonly componentName = input<string>('PartShippingStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly weightUnitOptions = measureUnitOptions('weight');
  protected readonly dimensionUnitOptions = measureUnitOptions('length');
  protected readonly volumeUnitOptions = measureUnitOptions('volume');

  protected readonly form = new FormGroup({
    weight: new FormControl<number | null>(null, [Validators.min(0)]),
    weightDisplayUnit: new FormControl<string>('g', { nonNullable: true }),
    length: new FormControl<number | null>(null, [Validators.min(0)]),
    width: new FormControl<number | null>(null, [Validators.min(0)]),
    height: new FormControl<number | null>(null, [Validators.min(0)]),
    dimensionDisplayUnit: new FormControl<string>('mm', { nonNullable: true }),
    volume: new FormControl<number | null>(null, [Validators.min(0)]),
    volumeDisplayUnit: new FormControl<string>('mL', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const part = this.entity() as PartDetail | null;
      if (!part) return;
      const dimensionUnit = measureDisplayUnit('length', part.dimensionDisplayUnit);
      const weightUnit = measureDisplayUnit('weight', part.weightDisplayUnit);
      const volumeUnit = measureDisplayUnit('volume', part.volumeDisplayUnit);
      this.form.patchValue({
        weight: fromCanonicalMeasure('weight', part.weightEach, weightUnit),
        weightDisplayUnit: weightUnit,
        length: fromCanonicalMeasure('length', part.lengthMm, dimensionUnit),
        width: fromCanonicalMeasure('length', part.widthMm, dimensionUnit),
        height: fromCanonicalMeasure('length', part.heightMm, dimensionUnit),
        dimensionDisplayUnit: dimensionUnit,
        volume: fromCanonicalMeasure('volume', part.volumeMl, volumeUnit),
        volumeDisplayUnit: volumeUnit,
      }, { emitEvent: false });
      this.workflowService.refreshStepForm();
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        weight: this.translate.instant('parts.workflow.shipping.weightLabel'),
        weightDisplayUnit: this.translate.instant('parts.workflow.shipping.weightUnitLabel'),
        length: this.translate.instant('parts.workflow.shipping.lengthLabel'),
        width: this.translate.instant('parts.workflow.shipping.widthLabel'),
        height: this.translate.instant('parts.workflow.shipping.heightLabel'),
        dimensionDisplayUnit: this.translate.instant('parts.workflow.shipping.dimensionUnitLabel'),
        volume: this.translate.instant('parts.workflow.shipping.volumeLabel'),
        volumeDisplayUnit: this.translate.instant('parts.workflow.shipping.volumeUnitLabel'),
      },
      () => this.save(),
    );
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    const runId = this.runId();
    if (runId == null) return of(null);
    if (this.form.pristine) return of(null);
    const v = this.form.getRawValue();

    this.saving.set(true);
    return this.workflowService.patchStep(runId, this.stepId(), {
      weightEach: toCanonicalMeasure('weight', v.weight, v.weightDisplayUnit),
      weightDisplayUnit: v.weightDisplayUnit,
      lengthMm: toCanonicalMeasure('length', v.length, v.dimensionDisplayUnit),
      widthMm: toCanonicalMeasure('length', v.width, v.dimensionDisplayUnit),
      heightMm: toCanonicalMeasure('length', v.height, v.dimensionDisplayUnit),
      dimensionDisplayUnit: v.dimensionDisplayUnit,
      volumeMl: toCanonicalMeasure('volume', v.volume, v.volumeDisplayUnit),
      volumeDisplayUnit: v.volumeDisplayUnit,
    }).pipe(
      switchMap((run) => {
        if (run.entityId == null) return of(null);
        return this.partsService.getPartById(run.entityId).pipe(
          tap((detail) => this.workflowService.currentEntity.set(detail)),
        );
      }),
      tap({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snackbar.errorFrom(err, 'parts.workflow.shipping.saveFailed');
        },
      }),
    );
  }
}
