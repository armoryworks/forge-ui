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

import { CustomerDetail } from '../../models/customer-detail.model';
import { CustomerService } from '../../services/customer.service';

/**
 * Parent page that mounts the <see cref="WorkflowComponent"/> shell over a
 * Customer at <c>/customers/new</c>. Differs from
 * <c>VendorWorkflowPageComponent</c> in one important way: customer
 * already has a real detail page at <c>/customers/:id/:tab</c>, so the
 * workflow does NOT URL-upgrade to <c>/customers/{id}</c> after
 * materialization. Instead the URL stays at <c>/customers/new?runId=N</c>
 * for the duration of the workflow and on completion the page navigates
 * to <c>/customers/{id}/overview</c> (the customer detail).
 *
 * Refresh-resume semantics still work: <c>?runId=N</c> in the URL lets
 * the loader re-hydrate the run + entity from the server.
 */
@Component({
  selector: 'app-customer-workflow-page',
  standalone: true,
  imports: [TranslatePipe, WorkflowComponent],
  templateUrl: './customer-workflow-page.component.html',
  styleUrl: './customer-workflow-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerWorkflowPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly loading = inject(LoadingService);

  protected readonly customer = signal<CustomerDetail | null>(null);
  protected readonly run = signal<WorkflowRun | null>(null);
  protected readonly definition = signal<WorkflowDefinition | null>(null);
  protected readonly validators = signal<EntityValidator[]>([]);
  protected readonly missingValidators = signal<MissingValidator[]>([]);

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
    const c = this.customer();
    if (c) return c.name;
    if (this.run()) return this.translate.instant('customers.workflow.page.newTitle');
    return this.translate.instant('customers.workflow.page.loadingTitle');
  });

  constructor() {
    effect(() => {
      const runId = this.runIdFromUrl();
      const definitionId = this.definitionIdFromUrl();
      if (!definitionId) return;
      if (runId) {
        this.loadByRun(runId, definitionId);
        return;
      }
      this.startFresh(definitionId);
    });

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

    effect(() => {
      const fresh = this.workflowService.currentEntity() as CustomerDetail | null;
      if (!fresh) return;
      if (this.customer() === fresh) return;
      this.customer.set(fresh);
    });
  }

  private startFresh(definitionId: string): void {
    this.loading.start('customer-workflow', this.translate.instant('customers.workflow.page.loading'));
    forkJoin({
      definitions: this.workflowService.loadDefinitionsForEntity('Customer'),
      validators: this.workflowService.loadValidatorsForEntity('Customer'),
    }).subscribe({
      next: ({ definitions, validators }) => {
        this.loading.stop('customer-workflow');
        const definition = definitions.find((d) => d.definitionId === definitionId) ?? null;
        if (!definition) {
          this.snackbar.error(this.translate.instant('customers.workflow.page.definitionMissing'));
          this.router.navigate(['/customers']);
          return;
        }
        this.workflowService.startRun({
          entityType: 'Customer',
          definitionId,
          mode: this.modeFromUrl(),
        }).subscribe({
          next: (created) => {
            this.run.set(created);
            this.customer.set(null);
            this.definition.set(definition);
            this.validators.set(validators);
            this.workflowService.setContext({ run: created, definition, entity: null, validators });
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { runId: created.id, step: created.currentStepId, mode: created.mode },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          },
          error: () => {
            this.snackbar.error(this.translate.instant('customers.workflow.page.startFailed'));
            this.router.navigate(['/customers']);
          },
        });
      },
      error: () => {
        this.loading.stop('customer-workflow');
        this.snackbar.error(this.translate.instant('customers.workflow.page.loadFailed'));
        this.router.navigate(['/customers']);
      },
    });
  }

  private loadByRun(runId: number, definitionId: string): void {
    this.loading.start('customer-workflow', this.translate.instant('customers.workflow.page.loading'));
    forkJoin({
      run: this.workflowService.getRun(runId),
      definitions: this.workflowService.loadDefinitionsForEntity('Customer'),
      validators: this.workflowService.loadValidatorsForEntity('Customer'),
    }).subscribe({
      next: ({ run, definitions, validators }) => {
        this.loading.stop('customer-workflow');
        const definition = definitions.find((d) => d.definitionId === definitionId) ?? null;
        if (!definition) {
          this.snackbar.error(this.translate.instant('customers.workflow.page.definitionMissing'));
          this.router.navigate(['/customers']);
          return;
        }
        if (run.entityId != null) {
          this.customerService.getCustomerById(run.entityId).subscribe({
            next: (customer) => {
              this.customer.set(customer);
              this.run.set(run);
              this.definition.set(definition);
              this.validators.set(validators);
              this.workflowService.setContext({ run, definition, entity: customer, validators });
            },
          });
          return;
        }
        this.customer.set(null);
        this.run.set(run);
        this.definition.set(definition);
        this.validators.set(validators);
        this.workflowService.setContext({ run, definition, entity: null, validators });
      },
      error: () => {
        this.loading.stop('customer-workflow');
        this.snackbar.error(this.translate.instant('customers.workflow.page.loadFailed'));
        this.router.navigate(['/customers']);
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
    const stepName = blockingStepLabel ? this.translate.instant(blockingStepLabel) : null;
    const message = stepName
      ? this.translate.instant('customers.workflow.page.blockedByStep', { step: stepName, missing: fieldList })
      : this.translate.instant('customers.workflow.page.missingValidators', { missing: fieldList });
    this.snackbar.error(message);
  }

  private saveThenNavigate(stepId: string): void {
    this.workflowService.saveCurrentStep().subscribe({
      next: (result) => { if (result.ok) this.navigateToStep(stepId); },
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
              this.snackbar.success(this.translate.instant('customers.workflow.page.completeSuccess'));
              // Navigate to the customer detail page (NOT /customers/:id —
              // that route redirects to /:id/overview anyway, and the
              // explicit form survives a future router-config tweak).
              const entityId = result.run.entityId ?? run.entityId;
              if (entityId != null) {
                this.router.navigate(['/customers', entityId, 'overview']);
              } else {
                this.router.navigate(['/customers']);
              }
            } else {
              this.missingValidators.set(result.missing);
              const missingDescription = result.missing
                .map((m) => this.translate.instant(m.missingMessageKey ?? m.displayNameKey))
                .join('; ');
              this.snackbar.error(this.translate.instant('customers.workflow.page.missingValidators', {
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
    this.router.navigate(['/customers']);
  }
}
