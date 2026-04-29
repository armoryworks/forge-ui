import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartType } from '../../models/part-type.type';
import { PartsService } from '../../services/parts.service';

/**
 * Workflow Pattern Phase 5 — Part Assembly basics step.
 *
 * Edits the gate fields for `hasBasics`: description, partType, material,
 * and surfaces externalPartNumber as a non-gated convenience field.
 * Persists each change via the parts UpdatePart endpoint after a 600ms
 * debounce so the user can type continuously without spamming PATCH calls.
 *
 * Uses the shared `<app-input>` / `<app-select>` wrappers per CLAUDE.md.
 * No inline styles. Form is ReactiveForms; signals drive the loaded state.
 */
@Component({
  selector: 'app-part-basics-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-basics-step.component.html',
  styleUrl: './part-basics-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartBasicsStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  // ─── Inputs (provided by the shell via *ngComponentOutlet) ──────────
  readonly stepId = input<string>('basics');
  readonly componentName = input<string>('PartBasicsStepComponent');
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    description: new FormControl('', [Validators.required, Validators.maxLength(500)]),
    partType: new FormControl<PartType>('Assembly', [Validators.required]),
    material: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    externalPartNumber: new FormControl('', [Validators.maxLength(100)]),
  });

  protected readonly partTypeOptions: SelectOption[] = [
    { value: 'Assembly', label: this.translate.instant('parts.typeAssembly') },
    { value: 'Part', label: this.translate.instant('parts.typePart') },
    { value: 'RawMaterial', label: this.translate.instant('parts.typeRawMaterial') },
    { value: 'Consumable', label: this.translate.instant('parts.typeConsumable') },
    { value: 'Tooling', label: this.translate.instant('parts.typeTooling') },
    { value: 'Fastener', label: this.translate.instant('parts.typeFastener') },
    { value: 'Electronic', label: this.translate.instant('parts.typeElectronic') },
    { value: 'Packaging', label: this.translate.instant('parts.typePackaging') },
  ];

  /** Suppresses the auto-save effect while we're patching the form from input. */
  private suppressDispatch = false;

  constructor() {
    // When the bound entity changes, re-hydrate the form (without dispatching saves).
    effect(() => {
      const part = this.entity() as PartDetail | null;
      if (!part) return;
      this.suppressDispatch = true;
      this.form.patchValue({
        description: part.description ?? '',
        partType: part.partType ?? 'Assembly',
        material: part.material ?? '',
        externalPartNumber: part.externalPartNumber ?? '',
      }, { emitEvent: false });
      this.suppressDispatch = false;
    });

    // Debounced auto-save on form changes.
    this.form.valueChanges
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.suppressDispatch) return;
        if (this.form.invalid) return;
        this.dispatchSave();
      });
  }

  private dispatchSave(): void {
    const id = this.entityId();
    if (id == null) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.partsService.updatePart(id, {
      description: value.description ?? undefined,
      partType: (value.partType as PartType) ?? undefined,
      material: value.material ?? undefined,
      externalPartNumber: value.externalPartNumber || undefined,
    }).subscribe({
      next: (detail) => {
        this.saving.set(false);
        // Reflect the latest server state into the workflow service so the
        // step rail's completion gates update.
        this.workflowService.currentEntity.set(detail);
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('parts.workflow.basics.saveFailed'));
      },
    });
  }
}
