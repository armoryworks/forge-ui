import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs/operators';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartType } from '../../models/part-type.type';
import { TraceabilityType } from '../../models/traceability-type.type';

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
    InputComponent, SelectComponent, TextareaComponent, LoadingBlockDirective,
    ValidationButtonComponent, CurrencyInputComponent,
  ],
  templateUrl: './part-express-form.component.html',
  styleUrl: './part-express-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartExpressFormComponent {
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly stepId = input<string>('express');
  readonly componentName = input<string>('PartExpressFormComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly part = computed<PartDetail | null>(() => (this.entity() as PartDetail | null) ?? null);

  /**
   * The Type select is redundant when the upstream fork dialog already wrote
   * `partType` onto the new entity. Hide it in that case and render a small
   * read-only chip beside the form title — the user must back out (or use
   * the part detail page) to change the type. When the form is mounted
   * without a pre-set type (defensive — no current flow does this), the
   * select still appears so the user can pick.
   */
  protected readonly partTypeLocked = computed<boolean>(() => {
    const t = this.part()?.partType;
    return t !== null && t !== undefined;
  });

  protected readonly partTypeLabel = computed<string>(() => {
    const t = this.part()?.partType;
    if (!t) return '';
    return this.translate.instant(`parts.type${t}`);
  });

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

  /**
   * Material is the assembly/part's primary composition (e.g., "Aluminum 6061").
   * For RawMaterial the description IS the material — the field is redundant.
   * For Consumable/Tooling/Fastener/Electronic/Packaging it's not meaningful.
   * Only show + collect it for `Part` (made part) and `Assembly`.
   *
   * The Part entity's `Material` column is nullable on the server, so the field
   * is intentionally NOT marked required here — the server contract is the
   * source of truth.
   */
  protected readonly form = new FormGroup({
    partType: new FormControl<PartType>('RawMaterial', [Validators.required]),
    name: new FormControl('', [Validators.required, Validators.maxLength(256)]),
    description: new FormControl('', [Validators.maxLength(2000)]),
    // Required because the hasBasics readiness gate requires it; without
    // this the user can fill the form, hit Save, and get an opaque
    // "missing Basics" 409 from the server. Mark required so the form
    // validation indicator surfaces it pre-submit.
    material: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    externalPartNumber: new FormControl('', [Validators.maxLength(100)]),
    // Pillar 1 / Tier 0 — manufacturer identity (engineering OEM, distinct
    // from the distributor we may buy through which lives on VendorPart).
    manufacturerName: new FormControl('', [Validators.maxLength(200)]),
    manufacturerPartNumber: new FormControl('', [Validators.maxLength(100)]),
    // Tier 0 — replaces legacy isSerialTracked boolean. Defaults None.
    traceabilityType: new FormControl<TraceabilityType>('None', [Validators.required]),
    // Required because the express step's hasCost gate needs either
    // manualCostOverride or currentCostCalculationId — only the override
    // is reachable from this form, so it's required here.
    manualCostOverride: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  protected readonly traceabilityOptions: SelectOption[] = [
    { value: 'None', label: this.translate.instant('parts.workflow.basics.traceabilityNone') },
    { value: 'Lot', label: this.translate.instant('parts.workflow.basics.traceabilityLot') },
    { value: 'Serial', label: this.translate.instant('parts.workflow.basics.traceabilitySerial') },
  ];

  /** Tracks the live partType selection so the Material visibility recomputes. */
  protected readonly partTypeSignal = toSignal(
    this.form.controls.partType.valueChanges.pipe(startWith(this.form.controls.partType.value)),
    { initialValue: this.form.controls.partType.value },
  );

  /**
   * Material field visibility. The hasBasics readiness validator requires
   * `material` to be present for ALL part types (not just made/assembly) —
   * so this previously-narrowing logic was the cause of "Cannot complete:
   * missing Basics" on raw materials. Now shown universally.
   *
   * For raw materials the Material field is the actual material spec (e.g.
   * "Polyethylene HDPE", "Aluminum 6061-T6"); for assemblies it's the
   * primary composition. Per the audit (Section 4 — every combo marks
   * Material as Required or Recommended), there is no combo where it
   * shouldn't be collected.
   */
  protected readonly showMaterialField = computed<boolean>(() => {
    // Acknowledge the partTypeSignal so changes still trigger recomputation
    // even though we no longer branch on it.
    void this.partTypeSignal();
    return true;
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partType: this.translate.instant('parts.workflow.basics.partTypeLabel'),
    name: this.translate.instant('parts.workflow.basics.nameLabel'),
    description: this.translate.instant('parts.workflow.basics.descriptionLabel'),
    material: this.translate.instant('parts.workflow.basics.materialLabel'),
    externalPartNumber: this.translate.instant('parts.workflow.basics.externalPartNumberLabel'),
    manufacturerName: this.translate.instant('parts.workflow.basics.manufacturerNameLabel'),
    manufacturerPartNumber: this.translate.instant('parts.workflow.basics.manufacturerPartNumberLabel'),
    traceabilityType: this.translate.instant('parts.workflow.basics.traceabilityLabel'),
    manualCostOverride: this.translate.instant('parts.workflow.costing.manualOverrideLabel'),
  });

  constructor() {
    // Re-hydrate from the bound entity when the workflow page resolves it
    // (e.g. resuming an in-flight run). No autosave: express mode is the
    // "one form, one click" path — every save creates / promotes a part,
    // so we only fire on the user's explicit Save click.
    effect(() => {
      const part = this.part();
      if (!part) return;
      this.form.patchValue({
        partType: part.partType ?? 'RawMaterial',
        name: part.name ?? '',
        description: part.description ?? '',
        material: part.material ?? '',
        externalPartNumber: part.externalPartNumber ?? '',
        manufacturerName: part.manufacturerName ?? '',
        manufacturerPartNumber: part.manufacturerPartNumber ?? '',
        traceabilityType: part.traceabilityType ?? 'None',
        manualCostOverride: part.manualCostOverride ?? null,
      }, { emitEvent: false });
    });
  }

  /**
   * Manual Save — express mode is one-form-one-click, so this submits AND
   * promotes. Patches the workflow step (which materializes the entity if
   * it doesn't exist yet, then applies fields), then completes the run
   * (Draft → Active), then navigates to the parts list.
   *
   * Autosave (the debounced valueChanges path) only patches — it never
   * completes — so the user can keep editing without the form snapping to
   * the list mid-typing.
   */
  protected save(): void {
    if (this.form.invalid) return;
    const runId = this.runId();
    if (runId == null) return;
    const fields = this.fieldsFromForm();
    this.saving.set(true);
    this.workflowService.patchStep(runId, this.stepId(), fields).subscribe({
      next: (run) => {
        if (run.entityId == null) {
          this.saving.set(false);
          return;
        }
        this.workflowService.completeRun(runId).subscribe({
          next: (result) => {
            this.saving.set(false);
            if (result.success) {
              this.snackbar.success(this.translate.instant('parts.workflow.express.saveSuccess'));
              this.router.navigate(['/parts']);
            } else {
              // Use the missingMessageKey when available (it's the
              // human-readable "what specifically is needed" string per
              // gate); fall back to the gate name otherwise.
              const missingDescription = result.missing
                .map(m => this.translate.instant(m.missingMessageKey ?? m.displayNameKey))
                .join('; ');
              this.snackbar.error(this.translate.instant('parts.workflow.page.missingValidators', {
                missing: missingDescription,
              }));
            }
          },
          error: () => {
            this.saving.set(false);
            this.snackbar.error(this.translate.instant('parts.workflow.express.saveFailed'));
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('parts.workflow.express.saveFailed'));
      },
    });
  }

  private fieldsFromForm(): Record<string, unknown> {
    const v = this.form.getRawValue();
    return {
      name: v.name ?? undefined,
      description: v.description ?? '',
      partType: (v.partType as PartType) ?? undefined,
      material: v.material ?? undefined,
      externalPartNumber: v.externalPartNumber || undefined,
      // Tier 0 — manufacturer + traceability now flow through the patch.
      manufacturerName: v.manufacturerName || undefined,
      manufacturerPartNumber: v.manufacturerPartNumber || undefined,
      traceabilityType: v.traceabilityType ?? 'None',
      // PartWorkflowAdapter.ApplyAsync interprets null as "clear" via
      // TryReadDecimal — different contract than PartsService.updatePart
      // which uses a -1 sentinel. Pass null explicitly here.
      manualCostOverride: v.manualCostOverride ?? null,
    };
  }
}
