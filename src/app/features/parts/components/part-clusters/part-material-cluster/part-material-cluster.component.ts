import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { ReferenceDataService } from '../../../../../shared/services/reference-data.service';
import { PartDetail } from '../../../models/part-detail.model';

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

  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  protected readonly materialSpecOptions = signal<SelectOption[]>([{ value: null, label: '-- None --' }]);

  // ── Conversion factors ──
  // Canonical: weight in grams, dimensions in mm, volume in mL.
  private readonly weightToGrams: Record<string, number> = {
    g: 1,
    kg: 1000,
    lb: 453.59237,
    oz: 28.3495,
  };
  private readonly dimensionToMm: Record<string, number> = {
    mm: 1,
    cm: 10,
    m: 1000,
    in: 25.4,
    ft: 304.8,
  };
  private readonly volumeToMl: Record<string, number> = {
    mL: 1,
    L: 1000,
    gal: 3785.41,
  };

  protected readonly weightUnitOptions: SelectOption[] = [
    { value: 'g', label: 'g' },
    { value: 'kg', label: 'kg' },
    { value: 'lb', label: 'lb' },
    { value: 'oz', label: 'oz' },
  ];

  protected readonly dimensionUnitOptions: SelectOption[] = [
    { value: 'mm', label: 'mm' },
    { value: 'cm', label: 'cm' },
    { value: 'm', label: 'm' },
    { value: 'in', label: 'in' },
    { value: 'ft', label: 'ft' },
  ];

  protected readonly volumeUnitOptions: SelectOption[] = [
    { value: 'mL', label: 'mL' },
    { value: 'L', label: 'L' },
    { value: 'gal', label: 'gal' },
  ];

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

  protected readonly displayMaterial = computed(() => {
    const p = this.part();
    return p.materialSpecLabel ?? null;
  });

  ngOnInit(): void {
    this.refData.getAsOptions('part.material_spec', { allLabel: '-- None --', valueField: 'code' }).subscribe({
      next: (_codeOptions) => {
        // We need id (not code) as the value, since materialSpecId is an int FK.
        // Re-load using getByGroup so we can map by id.
        this.refData.getByGroup('part.material_spec').subscribe({
          next: (items) => {
            const options: SelectOption[] = [{ value: null, label: '-- None --' }];
            const sorted = [...items]
              .filter(i => i.isActive)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            for (const item of sorted) {
              options.push({ value: item.id, label: item.label });
            }
            this.materialSpecOptions.set(options);
          },
        });
      },
    });
  }

  constructor() {
    effect(() => {
      const p = this.part();
      const weight = this.gramsToDisplay(p.weightEach, p.weightDisplayUnit);
      const dim = this.mmToDisplay(
        { length: p.lengthMm, width: p.widthMm, height: p.heightMm },
        p.dimensionDisplayUnit,
      );
      const vol = this.mlToDisplay(p.volumeMl, p.volumeDisplayUnit);
      this.form.reset({
        materialSpecId: p.materialSpecId,
        weight: weight.value,
        weightDisplayUnit: weight.unit,
        length: dim.length,
        width: dim.width,
        height: dim.height,
        dimensionDisplayUnit: dim.unit,
        volume: vol.value,
        volumeDisplayUnit: vol.unit,
      });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  private gramsToDisplay(grams: number | null, unit: string | null): { value: number | null; unit: string } {
    const u = unit && this.weightToGrams[unit] ? unit : 'g';
    if (grams === null) return { value: null, unit: u };
    return { value: grams / this.weightToGrams[u], unit: u };
  }

  private mmToDisplay(
    dims: { length: number | null; width: number | null; height: number | null },
    unit: string | null,
  ): { length: number | null; width: number | null; height: number | null; unit: string } {
    const u = unit && this.dimensionToMm[unit] ? unit : 'mm';
    const factor = this.dimensionToMm[u];
    return {
      length: dims.length === null ? null : dims.length / factor,
      width: dims.width === null ? null : dims.width / factor,
      height: dims.height === null ? null : dims.height / factor,
      unit: u,
    };
  }

  private mlToDisplay(ml: number | null, unit: string | null): { value: number | null; unit: string } {
    const u = unit && this.volumeToMl[unit] ? unit : 'mL';
    if (ml === null) return { value: null, unit: u };
    return { value: ml / this.volumeToMl[u], unit: u };
  }

  protected onSave(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const weightEach = v.weight === null
      ? null
      : v.weight * (this.weightToGrams[v.weightDisplayUnit] ?? 1);
    const dimFactor = this.dimensionToMm[v.dimensionDisplayUnit] ?? 1;
    const lengthMm = v.length === null ? null : v.length * dimFactor;
    const widthMm = v.width === null ? null : v.width * dimFactor;
    const heightMm = v.height === null ? null : v.height * dimFactor;
    const volumeMl = v.volume === null
      ? null
      : v.volume * (this.volumeToMl[v.volumeDisplayUnit] ?? 1);

    this.save.emit({
      materialSpecId: v.materialSpecId ?? null,
      weightEach,
      weightDisplayUnit: v.weightDisplayUnit,
      lengthMm,
      widthMm,
      heightMm,
      dimensionDisplayUnit: v.dimensionDisplayUnit,
      volumeMl,
      volumeDisplayUnit: v.volumeDisplayUnit,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
