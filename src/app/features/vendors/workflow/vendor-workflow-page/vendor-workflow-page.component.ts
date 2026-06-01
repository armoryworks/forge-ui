import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { forkJoin, map } from 'rxjs';

import { EntityValidator } from '../../../../shared/models/entity-validator.model';
import { LoadingService } from '../../../../shared/services/loading.service';
import { MissingValidator } from '../../../../shared/models/workflow-missing-validator.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowDefinition } from '../../../../shared/models/workflow-definition.model';
import { WorkflowComponent } from '../../../../shared/components/workflow/workflow.component';
import { WorkflowRun } from '../../../../shared/models/workflow-run.model';
import { WorkflowService } from '../../../../shared/services/workflow.service';

import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorService } from '../../services/vendor.service';

/**
 * Parent page that mounts the generic <see cref="WorkflowComponent"/> shell
 * over a Vendor. Mirrors <c>PartWorkflowPageComponent</c>'s URL-as-source-
 * of-truth contract: <c>?workflow=vendor-guided-v1</c> activates this view,
 * <c>?step=</c> tracks the current step, <c>?mode=</c> toggles guided vs.
 * express. Owns the wiring between the shell's typed events and the
 * <c>WorkflowService</c>'s HTTP calls.
 *
 * Two entry paths converge here:
 *   * <c>/vendors/new?workflow=vendor-guided-v1</c> — fresh wizard, vendor
 *     not yet materialized (deferred materialization). The first step's
 *     save creates the row + stamps <c>runId</c>; a URL-upgrade effect
 *     swings the page over to <c>/vendors/{id}?runId=…</c> for the rest
 *     of the flow.
 *   * <c>/vendors/{id}?workflow=vendor-guided-v1</c> — resume / re-enter
 *     an active run for an existing vendor.
 */
@Component({
  selector: 'app-vendor-workflow-page',
  standalone: true,
  imports: [TranslatePipe, WorkflowComponent],
  templateUrl: './vendor-workflow-page.component.html',
  styleUrl: './vendor-workflow-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorWorkflowPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly loading = inject(LoadingService);

  protected readonly vendor = signal<VendorDetail | null>(null);
  protected readonly run = signal<WorkflowRun | null>(null);
  protected readonly definition = signal<WorkflowDefinition | null>(null);
  protected readonly validators = signal<EntityValidator[]>([]);
  protected readonly missingValidators = signal<MissingValidator[]>([]);

  // ── URL-bound state ──
  private readonly vendorIdFromUrl = toSignal(
    this.route.paramMap.pipe(map((p) => {
      const raw = p.get('id');
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    })),
    { initialValue: 0 },
  );

  private readonly runIdFromUrl = toSignal(
    this.route.queryParamMap.pipe(map((p) => {
      const raw = p.get('runId');
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    })),
    { initialValue: 0 },
  );

  private readonly definitionIdFromUrl = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('workflow') ?? '')),
    { initialValue: '' },
  );

  private readonly stepFromUrl = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('step') ?? '')),
    { initialValue: '' },
  );

  private readonly modeFromUrl = toSignal(
    this.route.queryParamMap.pipe(map((p) => (p.get('mode') === 'express' ? 'express' : 'guided') as 'express' | 'guided')),
    { initialValue: 'guided' as 'express' | 'guided' },
  );

  protected readonly entityTitle = computed(() => {
    const v = this.vendor();
    if (v) return v.companyName;
    if (this.run()) return this.translate.instant('vendors.workflow.page.newTitle');
    return this.translate.instant('vendors.workflow.page.loadingTitle');
  });

  constructor() {
    effect(() => {
      const vendorId = this.vendorIdFromUrl();
      const runId = this.runIdFromUrl();
      const definitionId = this.definitionIdFromUrl();
      if (!definitionId) return;
      if (vendorId) {
        this.loadWorkflowContext(vendorId, definitionId);
        return;
      }
      if (runId) {
        this.loadEntitylessWorkflow(runId, definitionId);
        return;
      }
      // Fresh /vendors/new entry — no vendor, no run yet. Start one.
      this.startFreshWorkflow(definitionId);
    });

    // Deferred-materialization URL upgrade — when the workflow service emits
    // a run with a freshly-stamped entityId (after Identity's first patch),
    // swap /vendors/new for /vendors/{id} via replaceUrl.
    effect(() => {
      const run = this.workflowService.currentRun();
      if (!run || run.entityId == null) return;
      if (this.vendorIdFromUrl() !== 0) return;
      this.router.navigate(['/vendors', run.entityId], {
        queryParams: { runId: run.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    // Sync URL step/mode → run pointer so back/forward + jumps stay coherent.
    effect(() => {
      const target = this.stepFromUrl();
      const run = this.run();
      if (!target || !run) return;
      if (run.currentStepId === target) return;
      this.run.set({ ...run, currentStepId: target });
    });

    effect(() => {
      const mode = this.modeFromUrl();
      const run = this.run();
      if (!run || run.mode === mode) return;
      this.run.set({ ...run, mode });
    });

    // After any step's save refreshes WorkflowService.currentEntity, mirror
    // the fresh value into this page's vendor signal so the rail's gate
    // predicates evaluate against the latest persisted state.
    effect(() => {
      const fresh = this.workflowService.currentEntity() as VendorDetail | null;
      if (!fresh) return;
      const current = this.vendor();
      if (current === fresh) return;
      this.vendor.set(fresh);
    });
  }

  private startFreshWorkflow(definitionId: string): void {
    this.loading.start('vendor-workflow', this.translate.instant('vendors.workflow.page.loading'));
    forkJoin({
      definitions: this.workflowService.loadDefinitionsForEntity('Vendor'),
      validators: this.workflowService.loadValidatorsForEntity('Vendor'),
    }).subscribe({
      next: ({ definitions, validators }) => {
        this.loading.stop('vendor-workflow');
        const definition = definitions.find((d) => d.definitionId === definitionId) ?? null;
        if (!definition) {
          this.snackbar.error(this.translate.instant('vendors.workflow.page.definitionMissing'));
          this.router.navigate(['/vendors']);
          return;
        }
        this.workflowService.startRun({
          entityType: 'Vendor',
          definitionId,
          mode: this.modeFromUrl(),
        }).subscribe({
          next: (created) => {
            this.run.set(created);
            this.vendor.set(null);
            this.definition.set(definition);
            this.validators.set(validators);
            this.workflowService.setContext({ run: created, definition, entity: null, validators });
            // Pin runId in the URL so refresh / back-nav can find this run.
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { runId: created.id, step: created.currentStepId, mode: created.mode },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          },
          error: () => {
            this.snackbar.error(this.translate.instant('vendors.workflow.page.startFailed'));
            this.router.navigate(['/vendors']);
          },
        });
      },
      error: () => {
        this.loading.stop('vendor-workflow');
        this.snackbar.error(this.translate.instant('vendors.workflow.page.loadFailed'));
        this.router.navigate(['/vendors']);
      },
    });
  }

  private loadEntitylessWorkflow(runId: number, definitionId: string): void {
    this.loading.start('vendor-workflow', this.translate.instant('vendors.workflow.page.loading'));
    forkJoin({
      run: this.workflowService.getRun(runId),
      definitions: this.workflowService.loadDefinitionsForEntity('Vendor'),
      validators: this.workflowService.loadValidatorsForEntity('Vendor'),
    }).subscribe({
      next: ({ run, definitions, validators }) => {
        this.loading.stop('vendor-workflow');
        const definition = definitions.find((d) => d.definitionId === definitionId) ?? null;
        if (!definition) {
          this.snackbar.error(this.translate.instant('vendors.workflow.page.definitionMissing'));
          this.router.navigate(['/vendors']);
          return;
        }
        if (run.entityId != null) {
          this.vendorService.getVendorById(run.entityId).subscribe({
            next: (vendor) => {
              this.vendor.set(vendor);
              this.run.set(run);
              this.definition.set(definition);
              this.validators.set(validators);
              this.workflowService.setContext({ run, definition, entity: vendor, validators });
            },
          });
          return;
        }
        this.vendor.set(null);
        this.run.set(run);
        this.definition.set(definition);
        this.validators.set(validators);
        this.workflowService.setContext({ run, definition, entity: null, validators });
      },
      error: () => {
        this.loading.stop('vendor-workflow');
        this.snackbar.error(this.translate.instant('vendors.workflow.page.loadFailed'));
        this.router.navigate(['/vendors']);
      },
    });
  }

  private loadWorkflowContext(vendorId: number, definitionId: string): void {
    this.loading.start('vendor-workflow', this.translate.instant('vendors.workflow.page.loading'));
    forkJoin({
      vendor: this.vendorService.getVendorById(vendorId),
      activeRuns: this.workflowService.listActive(),
      definitions: this.workflowService.loadDefinitionsForEntity('Vendor'),
      validators: this.workflowService.loadValidatorsForEntity('Vendor'),
    }).subscribe({
      next: ({ vendor, activeRuns, definitions, validators }) => {
        this.loading.stop('vendor-workflow');
        const definition = definitions.find((d) => d.definitionId === definitionId) ?? null;
        if (!definition) {
          this.snackbar.error(this.translate.instant('vendors.workflow.page.definitionMissing'));
          this.router.navigate(['/vendors']);
          return;
        }
        const run = activeRuns.find((r) => r.entityType === 'Vendor' && r.entityId === vendorId
          && r.completedAt == null && r.abandonedAt == null
          && r.definitionId === definitionId) ?? null;

        if (!run) {
          this.workflowService.startRun({
            entityType: 'Vendor',
            definitionId,
            mode: this.modeFromUrl(),
          }).subscribe({
            next: (created) => {
              this.run.set(created);
              this.vendor.set(vendor);
              this.definition.set(definition);
              this.validators.set(validators);
              this.workflowService.setContext({ run: created, definition, entity: vendor, validators });
            },
            error: () => {
              this.snackbar.error(this.translate.instant('vendors.workflow.page.startFailed'));
              this.router.navigate(['/vendors']);
            },
          });
          return;
        }
        this.vendor.set(vendor);
        this.run.set(run);
        this.definition.set(definition);
        this.validators.set(validators);
        this.workflowService.setContext({ run, definition, entity: vendor, validators });

        if (run.mode === 'guided' && !this.stepFromUrl() && run.currentStepId) {
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { step: run.currentStepId, mode: run.mode },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      },
      error: () => {
        this.loading.stop('vendor-workflow');
        this.snackbar.error(this.translate.instant('vendors.workflow.page.loadFailed'));
        this.router.navigate(['/vendors']);
      },
    });
  }

  protected onModeChanged(mode: 'express' | 'guided'): void {
    const run = this.run();
    if (!run || run.mode === mode) return;
    this.workflowService.saveCurrentStep().subscribe({
      next: () => {
        this.workflowService.setMode(run.id, mode).subscribe({
          next: (updated) => {
            this.run.set(updated);
            this.workflowService.currentRun.set(updated);
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { mode },
              queryParamsHandling: 'merge',
            });
          },
        });
      },
    });
  }

  private navigateToStep(stepId: string): void {
    const run = this.run();
    if (!run) return;
    this.workflowService.jumpToStep(run.id, stepId).subscribe({
      next: (result) => {
        if (result.success) {
          this.run.set(result.run);
          this.workflowService.currentRun.set(result.run);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { step: stepId },
            queryParamsHandling: 'merge',
          });
          return;
        }
        this.missingValidators.set(result.missing);
        this.surfaceJumpBlocked(result.missing);
      },
    });
  }

  private surfaceJumpBlocked(missing: MissingValidator[]): void {
    if (missing.length === 0) return;
    const blockingStepLabel = missing.find((m) => !!m.blockingStepLabelKey)?.blockingStepLabelKey;
    const fieldList = missing
      .map((m) => this.translate.instant(m.missingMessageKey ?? m.displayNameKey))
      .join('; ');
    const stepName = blockingStepLabel
      ? this.translate.instant(blockingStepLabel)
      : null;
    const message = stepName
      ? this.translate.instant('vendors.workflow.page.blockedByStep', { step: stepName, missing: fieldList })
      : this.translate.instant('vendors.workflow.page.missingValidators', { missing: fieldList });
    this.snackbar.error(message);
  }

  private saveThenNavigate(stepId: string): void {
    this.workflowService.saveCurrentStep().subscribe({
      next: (result) => {
        if (result.ok) this.navigateToStep(stepId);
      },
    });
  }

  protected onStepJumped(stepId: string): void { this.saveThenNavigate(stepId); }

  protected onStepAdvanced(currentStepId: string): void {
    const def = this.definition();
    if (!def) return;
    const idx = def.steps.findIndex((s) => s.id === currentStepId);
    const next = def.steps[idx + 1]?.id;
    if (!next) return;
    this.saveThenNavigate(next);
  }

  protected onStepBacked(targetStepId: string): void { this.saveThenNavigate(targetStepId); }

  protected onStepSkipped(currentStepId: string): void {
    const def = this.definition();
    if (!def) return;
    const idx = def.steps.findIndex((s) => s.id === currentStepId);
    const next = def.steps[idx + 1]?.id;
    if (!next) return;
    this.navigateToStep(next);
  }

  protected onCompleteRequested(): void {
    const run = this.run();
    if (!run) return;
    this.workflowService.saveCurrentStep().subscribe({
      next: (saveResult) => {
        if (!saveResult.ok) return;
        this.workflowService.completeRun(run.id).subscribe({
          next: (result) => {
            if (result.success) {
              this.snackbar.success(this.translate.instant('vendors.workflow.page.completeSuccess'));
              this.router.navigate(['/vendors']);
            } else {
              this.missingValidators.set(result.missing);
              const missingDescription = result.missing
                .map((m) => this.translate.instant(m.missingMessageKey ?? m.displayNameKey))
                .join('; ');
              this.snackbar.error(this.translate.instant('vendors.workflow.page.missingValidators', {
                missing: missingDescription,
              }));
            }
          },
        });
      },
    });
  }

  protected onClosed(): void {
    this.workflowService.clearContext();
    this.router.navigate(['/vendors']);
  }
}
