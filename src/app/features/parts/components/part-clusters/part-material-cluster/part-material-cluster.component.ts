import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { AuthService } from '../../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { ReferenceDataItem, ReferenceDataService } from '../../../../../shared/services/reference-data.service';
import {
  fromCanonicalMeasure, measureDisplayUnit, measureUnitOptions, toCanonicalMeasure,
} from '../../../../../shared/utils/measure-units';
import { PartDetail } from '../../../models/part-detail.model';
import {
  MaterialSpecDialogComponent, MaterialSpecDialogData,
} from '../../material-spec-dialog/material-spec-dialog.component';
import { buildMaterialSpecOptions } from './material-spec-options.util';

const MATERIAL_SPEC_GROUP = 'part.material_spec';
const MATERIAL_SPEC_CREATE_ROLES = ['Admin', 'Manager', 'Engineer'];

/**
 * Pillar 4 Phase 2 — Material & physical cluster.
 *
 * Surfaces engineering material spec (FK to reference_data
 * group `part.material_spec`) with the legacy free-text Material as a
 * fallback. Edits weight (canonical grams) + dimensions (canonical mm)
 * + volume (canonical mL) with display-unit picker so the user types in
 * whatever unit they prefer; the cluster converts to the canonical SI
 * unit before emitting the patch.
 */
@Component({
  selector: 'app-part-material-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-material-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartMaterialClusterComponent implements OnInit {
  private readonly refData = inject(ReferenceDataService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly saveAndClose = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  protected readonly materialSpecOptions = signal<SelectOption[]>([{ value: null, label: '-- None --' }]);
  private readonly materialSpecItems = signal<ReferenceDataItem[]>([]);

  protected readonly weightUnitOptions = measureUnitOptions('weight');
  protected readonly dimensionUnitOptions = measureUnitOptions('length');
  protected readonly volumeUnitOptions = measureUnitOptions('volume');

  protected readonly form = new FormGroup({
    materialSpecId: new FormControl<number | null>(null),
    weight: new FormControl<number | null>(null, [Validators.min(0)]),
    weightDisplayUnit: new FormControl<string>('g', { nonNullable: true }),
    length: new FormControl<number | null>(null, [Validators.min(0)]),
    width: new FormControl<number | null>(null, [Validators.min(0)]),
    height: new FormControl<number | null>(null, [Validators.min(0)]),
    dimensionDisplayUnit: new FormControl<string>('mm', { nonNullable: true }),
    volume: new FormControl<number | null>(null, [Validators.min(0)]),
    volumeDisplayUnit: new FormControl<string>('mL', { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {});

  protected readonly canCreateMaterial = computed(() => this.auth.hasAnyRole(MATERIAL_SPEC_CREATE_ROLES));

  protected readonly displayMaterial = computed(() => {
    const p = this.part();
    return p.materialSpecLabel ?? null;
  });

  ngOnInit(): void {
    // Polish-pass follow-up — `part.material_spec` is hierarchical: parents
    // (e.g. "Aluminum", "Steel") have children (e.g. "6061-T6", "1018 Cold-
    // Rolled") via `parent_id`. Parents are not selectable; only leaves are.
    // Each leaf option's label is prefixed with its parent's label so the
    // dropdown reads as "Aluminum / 6061-T6" instead of bare "6061-T6".
    this.loadMaterialSpecs();
  }

  private loadMaterialSpecs(selectId?: number): void {
    this.refData.getByGroup(MATERIAL_SPEC_GROUP).subscribe({
      next: (items) => {
        this.materialSpecItems.set(items);
        this.materialSpecOptions.set(buildMaterialSpecOptions(items));
        if (selectId !== undefined) {
          const control = this.form.controls.materialSpecId;
          control.setValue(selectId);
          control.markAsDirty();
        }
      },
    });
  }

  protected openNewMaterial(): void {
    this.dialog.open<MaterialSpecDialogComponent, MaterialSpecDialogData, ReferenceDataItem | null>(
      MaterialSpecDialogComponent,
      { width: '480px', data: { items: this.materialSpecItems() } },
    ).afterClosed().subscribe((created) => {
      if (!created) return;
      this.refData.clearGroupCache(MATERIAL_SPEC_GROUP);
      this.loadMaterialSpecs(created.id);
    });
  }

  constructor() {
    effect(() => {
      const p = this.part();
      const dimensionUnit = measureDisplayUnit('length', p.dimensionDisplayUnit);
      const weightUnit = measureDisplayUnit('weight', p.weightDisplayUnit);
      const volumeUnit = measureDisplayUnit('volume', p.volumeDisplayUnit);
      this.form.reset({
        materialSpecId: p.materialSpecId,
        weight: fromCanonicalMeasure('weight', p.weightEach, weightUnit),
        weightDisplayUnit: weightUnit,
        length: fromCanonicalMeasure('length', p.lengthMm, dimensionUnit),
        width: fromCanonicalMeasure('length', p.widthMm, dimensionUnit),
        height: fromCanonicalMeasure('length', p.heightMm, dimensionUnit),
        dimensionDisplayUnit: dimensionUnit,
        volume: fromCanonicalMeasure('volume', p.volumeMl, volumeUnit),
        volumeDisplayUnit: volumeUnit,
      });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected onSave(close = false): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    (close ? this.saveAndClose : this.save).emit({
      materialSpecId: v.materialSpecId ?? null,
      weightEach: toCanonicalMeasure('weight', v.weight, v.weightDisplayUnit),
      weightDisplayUnit: v.weightDisplayUnit,
      lengthMm: toCanonicalMeasure('length', v.length, v.dimensionDisplayUnit),
      widthMm: toCanonicalMeasure('length', v.width, v.dimensionDisplayUnit),
      heightMm: toCanonicalMeasure('length', v.height, v.dimensionDisplayUnit),
      dimensionDisplayUnit: v.dimensionDisplayUnit,
      volumeMl: toCanonicalMeasure('volume', v.volume, v.volumeDisplayUnit),
      volumeDisplayUnit: v.volumeDisplayUnit,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
