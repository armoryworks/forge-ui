import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  EventEmitter,
  inject,
  input,
  Output,
  signal,
  Type,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EntityValidator } from '../../models/entity-validator.model';
import { MissingValidator } from '../../models/workflow-missing-validator.model';
import { WorkflowDefinition } from '../../models/workflow-definition.model';
import { WorkflowRun } from '../../models/workflow-run.model';
import { WorkflowStepDefinition } from '../../models/workflow-step-definition.model';
import { PredicateEvaluator } from '../../services/predicate-evaluator';
import { WorkflowService } from '../../services/workflow.service';
import { WorkflowStepRegistryService } from '../../services/workflow-step-registry.service';
import { SlideoutComponent } from '../slideout/slideout.component';
import { ValidationButtonComponent } from '../validation-button/validation-button.component';
import { WorkflowStepStubComponent } from './workflow-step-stub.component';

/**
 * Workflow Pattern Phase 4 — Generic shell that hosts a workflow run
 * (express or guided) over a loaded entity. The shell stays entity-agnostic;
 * per-step content comes from `WorkflowStepRegistryService`.
 *
 * Behavior contract:
 *   • D2 — step rail clickability: current OR earlier-completed step is
 *     clickable; future steps are locked. Earlier-completed = predicate
 *     gates pass for that step.
 *   • D4 — mode toggle is ALWAYS available (express ↔ guided), including
 *     mid-flow. Switching keeps the same currentStepId.
 *   • Mark Complete delegates to the entity-promote-status pipeline via
 *     the service (which round-trips to the server's authoritative gate).
 *
 * The shell is `<app-workflow>` and takes its inputs from a parent (a
 * feature module's detail page or the demo route). Actions emit outputs
 * the parent can wire to the WorkflowService — keeping the shell pure of
 * HTTP concerns and easy to test.
 */
@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [CommonModule, TranslatePipe, MatTooltipModule, SlideoutComponent, ValidationButtonComponent],
  templateUrl: './workflow.component.html',
  styleUrl: './workflow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowComponent {
  private readonly registry = inject(WorkflowStepRegistryService);
  private readonly evaluator = new PredicateEvaluator();
  private readonly translate = inject(TranslateService);
  protected readonly workflowService = inject(WorkflowService);

  // ─── Inputs ─────────────────────────────────────────────────────────

  readonly run = input<WorkflowRun | null>(null);
  readonly definition = input<WorkflowDefinition | null>(null);
  readonly entity = input<unknown>(null);
  readonly validators = input<EntityValidator[]>([]);
  /** Display title — entity-specific (e.g. "ASM-100" or "New Assembly"). */
  readonly entityTitle = input<string>('');
  /**
   * Server-reported missing validators from the most recent
   * Mark Complete / Promote attempt. The shell uses this to:
   *   • Highlight rail rows whose step owns a failed gate (red marker).
   *   • Render an inline alert at the top of the current step body when
   *     that step is the one blocking promotion.
   * Empty list = no recent failure (or it was cleared).
   */
  readonly missingValidators = input<MissingValidator[]>([]);

  /**
   * Read-only presentation. Used by the workflow-runs admin (b) and any
   * future history-view surface that wants to show the rail + current
   * step without form controls. When true:
   *   • The shell hides the entire footer (Back / Skip / Continue).
   *   • The mode toggle is hidden (no editing → no need to switch).
   *   • Step components receive readonly: true via stepInputs and are
   *     responsible for honoring it (disable form controls, hide their
   *     own Save buttons). Step components opt in to the contract; the
   *     shell trusts the input.
   */
  readonly readonly = input<boolean>(false);

  // ─── Outputs ────────────────────────────────────────────────────────

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly stepJumped = new EventEmitter<string>();
  @Output() readonly modeChanged = new EventEmitter<'express' | 'guided'>();
  @Output() readonly stepAdvanced = new EventEmitter<string>();
  @Output() readonly stepBacked = new EventEmitter<string>();
  @Output() readonly stepSkipped = new EventEmitter<string>();
  @Output() readonly completeRequested = new EventEmitter<void>();

  // ─── Derived state ──────────────────────────────────────────────────

  protected readonly mode = computed<'express' | 'guided'>(
    () => this.run()?.mode ?? this.definition()?.defaultMode ?? 'guided',
  );

  protected readonly steps = computed<WorkflowStepDefinition[]>(() => this.definition()?.steps ?? []);

  protected readonly currentStepId = computed<string | null>(() => {
    const explicit = this.run()?.currentStepId ?? null;
    if (explicit) return explicit;
    // Fall back to first step (initial mount before patchStep advances).
    return this.steps()[0]?.id ?? null;
  });

  protected readonly currentStepIndex = computed<number>(() => {
    const id = this.currentStepId();
    if (!id) return 0;
    return Math.max(0, this.steps().findIndex(s => s.id === id));
  });

  protected readonly currentStep = computed<WorkflowStepDefinition | null>(() => {
    const idx = this.currentStepIndex();
    return this.steps()[idx] ?? null;
  });

  /**
   * Highest step index the user has reached during this run instance.
   * Monotonic, so back-navigation inside a session keeps earlier steps
   * marked complete. Resets on remount (component lifecycle, page
   * refresh) — the server doesn't track "highest reached" today, so
   * fresh-mount behavior is "everything up to the server's currentStepId
   * has been visited".
   */
  private readonly maxReachedIndex = signal(0);

  /**
   * Highest visited index including the current pointer. Steps at or
   * below it have been visited; steps strictly below it have been left
   * behind.
   */
  private readonly reachedIndex = computed(() => Math.max(this.maxReachedIndex(), this.currentStepIndex()));

  constructor() {
    effect(() => {
      const current = this.currentStepIndex();
      if (current > this.maxReachedIndex()) {
        this.maxReachedIndex.set(current);
      }
    });
  }

  /**
   * Per-step predicate outcome for steps that declare `completionGates`
   * (steps without gates are absent). Non-applicable validators count as
   * satisfied, mirroring the server's EntityReadinessService so the rail
   * matches the server's missing-validators answer.
   */
  private readonly gatesPassedMap = computed<Map<string, boolean>>(() => {
    const def = this.definition();
    const entity = this.entity();
    const out = new Map<string, boolean>();
    if (!def || !entity) return out;
    const validatorsById = new Map<string, EntityValidator>();
    for (const v of this.validators()) validatorsById.set(v.validatorId, v);
    for (const step of def.steps) {
      if (step.completionGates.length === 0) continue;
      out.set(step.id, step.completionGates.every(gateId => {
        const v = validatorsById.get(gateId);
        if (!v) return false;
        if (v.applicabilityPredicate && !this.evaluator.evaluateJson(v.applicabilityPredicate, entity)) {
          return true;
        }
        return this.evaluator.evaluateJson(v.predicate, entity);
      }));
    }
    return out;
  });

  /**
   * Per-step completion shown on the rail. A step the user has moved past
   * is complete. A step whose gates pass is complete once the user has
   * visited it, so a trailing step that re-asserts an earlier gate (Review)
   * is not ticked before the user gets there.
   *
   * Evaluated inline (no service writes from a computed — that's NG0600).
   */
  protected readonly completionMap = computed<Map<string, boolean>>(() => {
    const out = new Map<string, boolean>();
    const passed = this.gatesPassedMap();
    const reached = this.reachedIndex();
    this.steps().forEach((step, idx) => {
      out.set(step.id, idx < reached || (idx <= reached && passed.get(step.id) === true));
    });
    return out;
  });

  /**
   * Whether a step no longer holds up the steps after it: its gates pass,
   * or the user has already moved past it. Drives rail clickability, which
   * may unlock a future step before it has been visited.
   */
  private readonly satisfiedMap = computed<Map<string, boolean>>(() => {
    const out = new Map<string, boolean>();
    const passed = this.gatesPassedMap();
    const reached = this.reachedIndex();
    this.steps().forEach((step, idx) => {
      out.set(step.id, idx < reached || passed.get(step.id) === true);
    });
    return out;
  });

  /**
   * Map of stepId → list of MissingValidator entries reported against that
   * step's completionGates. Drives both the rail's --has-error highlight
   * and the inline error alert at the top of the step body.
   */
  protected readonly errorsByStepId = computed<Map<string, MissingValidator[]>>(() => {
    const out = new Map<string, MissingValidator[]>();
    const missing = this.missingValidators();
    if (missing.length === 0) return out;
    for (const step of this.steps()) {
      if (step.completionGates.length === 0) continue;
      const gateIds = new Set(step.completionGates.map(g => g.toLowerCase()));
      const stepErrors = missing.filter(m => gateIds.has(m.validatorId.toLowerCase()));
      if (stepErrors.length > 0) out.set(step.id, stepErrors);
    }
    return out;
  });

  protected readonly currentStepErrors = computed<MissingValidator[]>(() => {
    const id = this.currentStepId();
    if (!id) return [];
    return this.errorsByStepId().get(id) ?? [];
  });

  protected hasError(step: WorkflowStepDefinition): boolean {
    return this.errorsByStepId().has(step.id);
  }

  /**
   * i18n key for the right context pane's "Why this step" rationale,
   * derived from the current step + the run's entity type. Convention:
   * `{entityTypePluralLowercase}.workflow.{stepId}.rationale`. Returns
   * null when the resolved key has no translation — the pane simply
   * doesn't render rather than showing a raw key.
   */
  protected readonly currentStepRationaleKey = computed<string | null>(() => {
    const step = this.currentStep();
    const entity = this.run()?.entityType;
    if (!step || !entity) return null;
    const plural = entity.toLowerCase() + 's'; // parts.*, customers.*, etc.
    const key = `${plural}.workflow.${step.id}.rationale`;
    const resolved = this.translate.instant(key);
    return resolved && resolved !== key ? key : null;
  });

  /**
   * On-demand rationale sidecar visibility. Closed by default; user opens
   * via the header "?" icon and dismisses by clicking it again or by any
   * navigation event (step jump, back/next, mode toggle). NOT persisted —
   * truly transient per the team's UX call (2026-05-04): persistent
   * rationale text consumed too much horizontal space in guided mode and
   * cramped the form column. Help-on-demand pattern (Whitenton/NN/g
   * "progressive disclosure") replaces it.
   */
  protected readonly rationaleOpen = signal<boolean>(false);

  protected toggleRationale(): void {
    this.rationaleOpen.update(v => !v);
  }

  /**
   * Auto-dismiss the rationale sidecar whenever the dialog's state
   * changes (step jump, mode toggle). The current step's id and the
   * mode are the only inputs the user uses to "navigate" inside the
   * dialog; both should reset transient help state. Reading the two
   * signals registers them as effect deps; .set() is a no-op when the
   * value hasn't changed (signal default equality), so this can't loop.
   */
  private readonly autoDismissRationale = effect(() => {
    this.currentStepId();
    this.mode();
    this.rationaleOpen.set(false);
  });

  protected readonly isFirstStep = computed(() => this.currentStepIndex() === 0);
  protected readonly isLastStep = computed(() => {
    const steps = this.steps();
    return steps.length > 0 && this.currentStepIndex() === steps.length - 1;
  });

  /** Per-step component class to instantiate via `*ngComponentOutlet`. */
  protected readonly currentStepComponent = computed<Type<unknown>>(() => {
    const step = this.currentStep();
    if (!step) return WorkflowStepStubComponent;
    return this.registry.get(step.componentName) ?? WorkflowStepStubComponent;
  });

  /** Inputs piped to the current step component. */
  protected readonly stepInputs = computed<Record<string, unknown>>(() => {
    const step = this.currentStep();
    const r = this.run();
    return {
      stepId: step?.id ?? '',
      componentName: step?.componentName ?? '',
      runId: r?.id ?? null,
      entityId: r?.entityId ?? null,
      entity: this.entity(),
      readonly: this.readonly(),
    };
  });

  /** Express-mode template component (one per entity type). */
  protected readonly expressComponent = computed<Type<unknown>>(() => {
    const def = this.definition();
    if (!def?.expressTemplateComponent) return WorkflowStepStubComponent;
    return this.registry.getExpress(def.expressTemplateComponent) ?? WorkflowStepStubComponent;
  });

  /**
   * Inputs piped to the express component. Express mode collapses the
   * workflow into a single step, but the stepId we send back through
   * patchStep must match the definition — for raw-material-express-v1
   * that's "all", not the literal "express" the express component used to
   * default to. Use the first (and only) step in the definition; fall back
   * to "express" if the definition somehow has no steps.
   */
  protected readonly expressInputs = computed<Record<string, unknown>>(() => {
    const r = this.run();
    const stepId = this.steps()[0]?.id ?? 'express';
    return {
      stepId,
      componentName: this.definition()?.expressTemplateComponent ?? '',
      runId: r?.id ?? null,
      entityId: r?.entityId ?? null,
      entity: this.entity(),
      readonly: this.readonly(),
    };
  });

  // ─── D2 step rail clickability ──────────────────────────────────────

  /**
   * A step is "clickable" if it is the current step OR an earlier-completed
   * step. A step is "locked" (future) when its index > currentStepIndex
   * AND not all required gates between current and target pass.
   */
  protected isClickable(step: WorkflowStepDefinition): boolean {
    const idx = this.steps().findIndex(s => s.id === step.id);
    const currentIdx = this.currentStepIndex();
    if (idx <= currentIdx) return true;
    const map = this.satisfiedMap();
    for (let i = 0; i < idx; i++) {
      const s = this.steps()[i];
      if (!s.required) continue;
      if (!map.get(s.id)) return false;
    }
    return true;
  }

  protected isFutureStep(step: WorkflowStepDefinition): boolean {
    return !this.isClickable(step);
  }

  protected isComplete(step: WorkflowStepDefinition): boolean {
    return this.completionMap().get(step.id) === true;
  }

  protected isCurrent(step: WorkflowStepDefinition): boolean {
    return this.currentStepId() === step.id;
  }

  // ─── Action handlers ────────────────────────────────────────────────

  protected jumpTo(step: WorkflowStepDefinition): void {
    if (!this.isClickable(step)) return;
    this.stepJumped.emit(step.id);
  }

  protected setMode(mode: 'express' | 'guided'): void {
    if (mode === this.mode()) return;
    // Lossless switch (F21): express and guided edit the *same* underlying
    // entity fields, just laid out differently — so unsaved edits on the
    // current step shouldn't be discarded. Persist them first via the step's
    // registered save callback, then switch; the destination mode reloads the
    // same data. On save failure the step component surfaces the error and we
    // stay put. (Previously this prompted "switch and discard", losing input.)
    if (this.workflowService.currentStepDirty()) {
      this.workflowService.saveCurrentStep().subscribe(result => {
        if (result.ok) this.modeChanged.emit(mode);
      });
      return;
    }
    this.modeChanged.emit(mode);
  }

  protected back(): void {
    if (this.isFirstStep()) return;
    const prev = this.steps()[this.currentStepIndex() - 1];
    if (prev) this.stepBacked.emit(prev.id);
  }

  protected next(): void {
    if (this.isLastStep()) {
      this.completeRequested.emit();
      return;
    }
    const current = this.currentStep();
    if (current) this.stepAdvanced.emit(current.id);
  }

  protected skip(): void {
    const current = this.currentStep();
    if (!current || current.required) return;
    this.stepSkipped.emit(current.id);
  }

  protected close(): void {
    this.closed.emit();
  }
}
