import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartType } from '../../models/part-type.type';
import { PartsService } from '../../services/parts.service';

/**
 * Workflow Pattern Phase 5 — Express form for parts (raw-material default).
 *
 * Single-step variant: every gated field visible at once. Same fields as the
 * guided basics + costing steps combined. Auto-saves on field change so the
 * user can hit "Mark Complete" from the shell footer once the gates light up.
 *
 * The same record persists to the same Part row; just a denser presentation.
 */
@Component({
  selector: 'app-part-express-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-express-form.component.html',
  styleUrl: './part-express-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartExpressFormComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('express');
  readonly componentName = input<string>('PartExpressFormComponent');
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly part = computed<PartDetail | null>(() => (this.entity() as PartDetail | null) ?? null);

  protected readonly partTypeOptions: SelectOption[] = [
    { value: 'RawMaterial', label: this.translate.instant('parts.typeRawMaterial') },
    { value: 'Part', label: this.translate.instant('parts.typePart') },
    { value: 'Assembly', label: this.translate.instant('parts.typeAssembly') },
    { value: 'Consumable', label: this.translate.instant('parts.typeConsumable') },
    { value: 'Tooling', label: this.translate.instant('parts.typeTooling') },
    { value: 'Fastener', label: this.translate.instant('parts.typeFastener') },
    { value: 'Electronic', label: this.translate.instant('parts.typeElectronic') },
    { value: 'Packaging', label: this.translate.instant('parts.typePackaging') },
  ];

  protected readonly form = new FormGroup({
    partType: new FormControl<PartType>('RawMaterial', [Validators.required]),
    description: new FormControl('', [Validators.required, Validators.maxLength(500)]),
    material: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    externalPartNumber: new FormControl('', [Validators.maxLength(100)]),
    manualCostOverride: new FormControl<number | null>(null, [Validators.min(0)]),
  });

  private suppressDispatch = false;

  constructor() {
    effect(() => {
      const part = this.part();
      if (!part) return;
      this.suppressDispatch = true;
      this.form.patchValue({
        partType: part.partType ?? 'RawMaterial',
        description: part.description ?? '',
        material: part.material ?? '',
        externalPartNumber: part.externalPartNumber ?? '',
        manualCostOverride: part.manualCostOverride ?? null,
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

  protected save(): void {
    if (this.form.invalid) return;
    this.dispatchSave();
  }

  private dispatchSave(): void {
    const id = this.entityId();
    if (id == null) return;
    const v = this.form.getRawValue();
    const overrideToSend = v.manualCostOverride == null ? -1 : v.manualCostOverride;
    this.saving.set(true);
    this.partsService.updatePart(id, {
      description: v.description ?? undefined,
      partType: (v.partType as PartType) ?? undefined,
      material: v.material ?? undefined,
      externalPartNumber: v.externalPartNumber || undefined,
      manualCostOverride: overrideToSend,
    }).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.workflowService.currentEntity.set(detail);
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('parts.workflow.express.saveFailed'));
      },
    });
  }
}
