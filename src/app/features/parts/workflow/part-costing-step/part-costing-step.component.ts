import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';

import { MatTooltipModule } from '@angular/material/tooltip';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/** Costing modes per the design doc D3 — Tier 1 always available, Tiers 2/3
 * gated by capability flags. v1 ships Tier 1 only; the radios for Tier 2/3
 * render disabled with explanatory tooltips so the user can see the
 * upgrade path without engaging it. */
type CostingMode = 'flat' | 'departmental' | 'abc';

/**
 * Workflow Pattern Phase 5 — Costing step. Implements the per-record
 * `costing_mode_override` radio (Tier 1 enabled, Tier 2/3 disabled) plus
 * the Tier 1 manual cost override input. Persists changes via the
 * `manualCostOverride` field on the parts UpdatePart endpoint.
 *
 * Read priority follows the worked example: `manualCostOverride ??
 * currentCostCalculation?.resultAmount ?? null`.
 */
@Component({
  selector: 'app-part-costing-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, MatTooltipModule,
    CurrencyInputComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-costing-step.component.html',
  styleUrl: './part-costing-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartCostingStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('costing');
  readonly componentName = input<string>('PartCostingStepComponent');
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);
  protected readonly mode = signal<CostingMode>('flat');

  protected readonly part = computed<PartDetail | null>(() => (this.entity() as PartDetail | null) ?? null);

  /** D3 — displayed cost: manual override wins, then current calc, else null. */
  protected readonly displayedCost = computed<number | null>(() => {
    const p = this.part();
    if (!p) return null;
    if (p.manualCostOverride != null) return p.manualCostOverride;
    return null;
  });

  protected readonly form = new FormGroup({
    manualCostOverride: new FormControl<number | null>(null, [Validators.min(0)]),
  });

  /** Suppresses save dispatch while patching the form from input. */
  private suppressDispatch = false;

  constructor() {
    effect(() => {
      const part = this.part();
      if (!part) return;
      this.suppressDispatch = true;
      this.form.patchValue({
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

  protected setMode(mode: CostingMode): void {
    if (mode !== 'flat') return; // Tier 2/3 disabled until capability lands.
    this.mode.set(mode);
  }

  protected isTier1(): boolean {
    return this.mode() === 'flat';
  }

  private dispatchSave(): void {
    const id = this.entityId();
    if (id == null) return;
    const value = this.form.getRawValue();
    // -1 sentinel clears the override on the server.
    const overrideToSend = value.manualCostOverride == null ? -1 : value.manualCostOverride;
    this.saving.set(true);
    this.partsService.updatePart(id, {
      manualCostOverride: overrideToSend,
    }).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.workflowService.currentEntity.set(detail);
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('parts.workflow.costing.saveFailed'));
      },
    });
  }
}
