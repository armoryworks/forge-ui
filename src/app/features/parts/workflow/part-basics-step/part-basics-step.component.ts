import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/**
 * Workflow Pattern Phase 5 — Part Assembly basics step.
 *
 * Edits the gate fields for `hasBasics`: name, partType, material, plus
 * description (optional) and externalPartNumber (non-gated convenience).
 * Persists each change via the workflow's PatchWorkflowStep endpoint after
 * a 600ms debounce — that endpoint owns deferred materialization, so the
 * first save creates the underlying Part row when the workflow was started
 * with no entity yet. Subsequent saves apply field updates to the now-real
 * entity through the same endpoint.
 *
 * Uses the shared `<app-input>` / `<app-select>` wrappers per CLAUDE.md.
 * No inline styles. Form is ReactiveForms; signals drive the loaded state.
 */
@Component({
  selector: 'app-part-basics-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, TextareaComponent, LoadingBlockDirective,
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
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(256)]),
    description: new FormControl('', [Validators.maxLength(2000)]),
    externalPartNumber: new FormControl('', [Validators.maxLength(100)]),
    // Tier 0 — manufacturer identity (engineering OEM, distinct from any
    // distributor we buy through, which lives on VendorPart).
    manufacturerName: new FormControl('', [Validators.maxLength(200)]),
    manufacturerPartNumber: new FormControl('', [Validators.maxLength(100)]),
  });

  /** Suppresses the auto-save effect while we're patching the form from input. */
  private suppressDispatch = false;

  constructor() {
    // When the bound entity changes, re-hydrate the form (without dispatching saves).
    effect(() => {
      const part = this.entity() as PartDetail | null;
      if (!part) return;
      this.suppressDispatch = true;
      this.form.patchValue({
        name: part.name ?? '',
        description: part.description ?? '',
        externalPartNumber: part.externalPartNumber ?? '',
        manufacturerName: part.manufacturerName ?? '',
        manufacturerPartNumber: part.manufacturerPartNumber ?? '',
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

    // Register form with the shell so Continue gates on validity + the
    // app-validation-button surfaces required-field violations.
    this.workflowService.registerStepForm(this.form, {
      name: this.translate.instant('parts.workflow.basics.nameLabel'),
      description: this.translate.instant('parts.workflow.basics.descriptionLabel'),
      externalPartNumber: this.translate.instant('parts.workflow.basics.externalPartNumberLabel'),
      manufacturerName: this.translate.instant('parts.workflow.basics.manufacturerNameLabel'),
      manufacturerPartNumber: this.translate.instant('parts.workflow.basics.manufacturerPartNumberLabel'),
    });
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private dispatchSave(): void {
    const runId = this.runId();
    if (runId == null) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    // Always patch through the workflow endpoint — it transparently
    // materializes the entity on first call (when entityId is still null
    // server-side) and applies field updates on subsequent calls. The
    // returned run carries the now-stamped entityId; we re-fetch the
    // entity so the rail's gate evaluation reflects current state.
    this.workflowService.patchStep(runId, this.stepId(), {
      name: value.name ?? undefined,
      description: value.description ?? '',
      externalPartNumber: value.externalPartNumber || undefined,
      // Tier 0 — manufacturer identity.
      manufacturerName: value.manufacturerName || undefined,
      manufacturerPartNumber: value.manufacturerPartNumber || undefined,
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
        this.snackbar.error(this.translate.instant('parts.workflow.basics.saveFailed'));
      },
    });
  }
}
