import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { EntityValidator } from '../../models/entity-validator.model';
import { WorkflowDefinition } from '../../models/workflow-definition.model';
import { WorkflowRun } from '../../models/workflow-run.model';
import { WorkflowStepDefinition } from '../../models/workflow-step-definition.model';
import { WorkflowStepRegistryService } from '../../services/workflow-step-registry.service';
import { WorkflowComponent } from './workflow.component';
import { WorkflowStepStubComponent } from './workflow-step-stub.component';

/**
 * Workflow Pattern Phase 4 — Shell tests.
 *
 * Driven via direct property mutation on signal inputs (the harness in
 * this project doesn't reliably propagate signal-based `input()` through
 * JIT-compiled host templates — but the inputs themselves are writable
 * `WritableSignal`s on the component instance, so we drive them directly).
 *
 * Coverage focuses on PUBLIC METHODS and DERIVED SIGNALS — these are the
 * exact bindings the template uses (`@if`, `@for`, `[disabled]`, `(click)`),
 * so verifying them is equivalent to verifying the rendered DOM. The
 * Playwright smoke at /workflow-shell-demo provides full DOM verification.
 *
 * Behavior contract:
 *   • D2 — step rail clickability (current OR earlier-completed = clickable; future = locked)
 *   • D4 — mode toggle works mid-flow without losing currentStepId
 *   • Footer button behavior (back/next/skip/complete) per step + required flag
 *   • Component-outlet returns the registered ctor (or stub fallback)
 */

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> {
    return of({});
  }
}

@Component({
  selector: 'app-fake-step',
  standalone: true,
  template: '<div class="fake-step">FakeStep</div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FakeStepComponent {}

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 1,
    entityType: 'Part',
    entityId: 42,
    definitionId: 'part-assembly-guided-v1',
    currentStepId: 'basics',
    mode: 'guided',
    startedAt: '2026-04-29T00:00:00Z',
    startedByUserId: 7,
    completedAt: null,
    abandonedAt: null,
    abandonedReason: null,
    lastActivityAt: '2026-04-29T00:00:00Z',
    version: 1,
    draftPayload: null,
    ...overrides,
  };
}

function buildDef(): WorkflowDefinition {
  return {
    id: 1,
    definitionId: 'part-assembly-guided-v1',
    entityType: 'Part',
    defaultMode: 'guided',
    steps: [
      { id: 'basics', labelKey: 'workflow.parts.steps.basics', componentName: 'PartBasicsStepComponent', required: true, completionGates: ['hasBasics'] },
      { id: 'bom', labelKey: 'workflow.parts.steps.bom', componentName: 'PartBomStepComponent', required: true, completionGates: ['hasBom'] },
      { id: 'alternates', labelKey: 'workflow.parts.steps.alternates', componentName: 'PartAlternatesStepComponent', required: false, completionGates: [] },
    ],
    stepsJson: '[]',
    expressTemplateComponent: 'PartExpressFormComponent',
    isSeedData: true,
  };
}

function buildValidators(): EntityValidator[] {
  return [
    {
      id: 1, entityType: 'Part', validatorId: 'hasBasics',
      predicate: JSON.stringify({ type: 'fieldPresent', field: 'name' }),
      displayNameKey: 'k', missingMessageKey: 'm', isSeedData: true,
    },
    {
      id: 2, entityType: 'Part', validatorId: 'hasBom',
      predicate: JSON.stringify({ type: 'relationExists', relation: 'bomLines', minCount: 1 }),
      displayNameKey: 'k', missingMessageKey: 'm', isSeedData: true,
    },
  ];
}

/**
 * Build a WorkflowComponent with mocked input signals (same `signal()` shape
 * the framework uses internally for input(); our component reads them as
 * function calls, so a `signal()` substitution Just Works).
 */
function buildShell(opts: {
  run?: WorkflowRun | null;
  definition?: WorkflowDefinition | null;
  entity?: unknown;
  validators?: EntityValidator[];
  entityTitle?: string;
} = {}): { component: WorkflowComponent; registry: WorkflowStepRegistryService } {
  const registry = TestBed.inject(WorkflowStepRegistryService);
  const component = TestBed.runInInjectionContext(() => new WorkflowComponent());

  // Override the input signals with writable plain signals so we can mutate
  // them directly. The shell reads them as function calls (`this.run()`),
  // so any function-shaped getter works — we use `signal()` for parity.
  Object.defineProperty(component, 'run', { value: signal<WorkflowRun | null>(opts.run ?? buildRun()), writable: true });
  Object.defineProperty(component, 'definition', { value: signal<WorkflowDefinition | null>(opts.definition ?? buildDef()), writable: true });
  Object.defineProperty(component, 'entity', { value: signal<unknown>(opts.entity ?? {}), writable: true });
  Object.defineProperty(component, 'validators', { value: signal<EntityValidator[]>(opts.validators ?? buildValidators()), writable: true });
  Object.defineProperty(component, 'entityTitle', { value: signal<string>(opts.entityTitle ?? 'New Assembly'), writable: true });

  return { component, registry };
}

describe('WorkflowComponent — shell logic (Phase 4)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowComponent, FakeStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: FakeLoader },
        }),
      ],
    }).compileComponents();
    TestBed.inject(WorkflowStepRegistryService).clear();
  });

  // ─── helpers — bypass `protected` for test access ──────────────────

  function pick<T>(component: WorkflowComponent, key: string): T {
    return (component as unknown as Record<string, T>)[key];
  }

  // ─── basic state ────────────────────────────────────────────────────

  it('exposes mode and currentStepId from the run input', () => {
    const { component } = buildShell();
    expect(pick<() => string>(component, 'mode')()).toBe('guided');
    expect(pick<() => string>(component, 'currentStepId')()).toBe('basics');
  });

  // ─── D2 — step rail clickability ────────────────────────────────────

  it('D2: current step is clickable', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'basics' }) });
    const isClickable = pick<(s: WorkflowStepDefinition) => boolean>(component, 'isClickable');
    const steps = pick<() => WorkflowStepDefinition[]>(component, 'steps')();
    expect(isClickable.call(component, steps[0])).toBe(true);
  });

  it('D2: earlier-completed step is clickable, future step (uncompleted predecessors) is locked', () => {
    const { component } = buildShell({
      run: buildRun({ currentStepId: 'bom' }),
      entity: { name: 'Widget' },
    });
    const isClickable = pick<(s: WorkflowStepDefinition) => boolean>(component, 'isClickable');
    const steps = pick<() => WorkflowStepDefinition[]>(component, 'steps')();
    expect(isClickable.call(component, steps[0])).toBe(true);  // basics — earlier
    expect(isClickable.call(component, steps[1])).toBe(true);  // bom — current
    expect(isClickable.call(component, steps[2])).toBe(false); // alternates — future + bom not done
  });

  it('D2: future step is locked when its predecessors\' gates have not all passed', () => {
    const { component } = buildShell({
      run: buildRun({ currentStepId: 'basics' }),
      entity: {}, // no name → hasBasics fails
    });
    const isFutureStep = pick<(s: WorkflowStepDefinition) => boolean>(component, 'isFutureStep');
    const steps = pick<() => WorkflowStepDefinition[]>(component, 'steps')();
    expect(isFutureStep.call(component, steps[1])).toBe(true);
    expect(isFutureStep.call(component, steps[2])).toBe(true);
  });

  it('D2: jumpTo on a clickable step emits stepJumped', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'bom' }), entity: { name: 'Widget' } });
    const events: string[] = [];
    component.stepJumped.subscribe(e => events.push(e));
    const jumpTo = pick<(s: WorkflowStepDefinition) => void>(component, 'jumpTo');
    const steps = pick<() => WorkflowStepDefinition[]>(component, 'steps')();
    jumpTo.call(component, steps[0]);
    expect(events).toEqual(['basics']);
  });

  it('D2: jumpTo on a locked step does NOT emit stepJumped', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'basics' }), entity: {} });
    const events: string[] = [];
    component.stepJumped.subscribe(e => events.push(e));
    const jumpTo = pick<(s: WorkflowStepDefinition) => void>(component, 'jumpTo');
    const steps = pick<() => WorkflowStepDefinition[]>(component, 'steps')();
    jumpTo.call(component, steps[1]); // bom — locked
    expect(events).toEqual([]);
  });

  // ─── D4 — mode toggle ──────────────────────────────────────────────

  it('D4: setMode emits modeChanged when changing modes', () => {
    const { component } = buildShell({ run: buildRun({ mode: 'guided' }) });
    const events: ('express' | 'guided')[] = [];
    component.modeChanged.subscribe(e => events.push(e));
    pick<(m: 'express' | 'guided') => void>(component, 'setMode').call(component, 'express');
    expect(events).toEqual(['express']);
  });

  it('D4: setMode does NOT re-emit when called with the active mode', () => {
    const { component } = buildShell({ run: buildRun({ mode: 'guided' }) });
    const events: ('express' | 'guided')[] = [];
    component.modeChanged.subscribe(e => events.push(e));
    pick<(m: 'express' | 'guided') => void>(component, 'setMode').call(component, 'guided');
    expect(events).toEqual([]);
  });

  it('D4: mode toggle is available mid-flow (currentStepId preserved)', () => {
    const { component } = buildShell({ run: buildRun({ mode: 'guided', currentStepId: 'bom' }) });
    expect(pick<() => string>(component, 'currentStepId')()).toBe('bom');
    expect(pick<() => string>(component, 'mode')()).toBe('guided');
    const events: ('express' | 'guided')[] = [];
    component.modeChanged.subscribe(e => events.push(e));
    pick<(m: 'express' | 'guided') => void>(component, 'setMode').call(component, 'express');
    expect(events).toEqual(['express']);
    expect(pick<() => string>(component, 'currentStepId')()).toBe('bom');
  });

  // ─── Footer / actions ──────────────────────────────────────────────

  it('isFirstStep / isLastStep flags reflect the pointer', () => {
    let { component } = buildShell({ run: buildRun({ currentStepId: 'basics' }) });
    expect(pick<() => boolean>(component, 'isFirstStep')()).toBe(true);
    expect(pick<() => boolean>(component, 'isLastStep')()).toBe(false);

    ({ component } = buildShell({ run: buildRun({ currentStepId: 'alternates' }) }));
    expect(pick<() => boolean>(component, 'isFirstStep')()).toBe(false);
    expect(pick<() => boolean>(component, 'isLastStep')()).toBe(true);
  });

  it('next on a non-last step emits stepAdvanced', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'basics' }) });
    const events: string[] = [];
    component.stepAdvanced.subscribe(e => events.push(e));
    pick<() => void>(component, 'next').call(component);
    expect(events).toEqual(['basics']);
  });

  it('next on the last step emits completeRequested', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'alternates' }) });
    let count = 0;
    component.completeRequested.subscribe(() => count++);
    pick<() => void>(component, 'next').call(component);
    expect(count).toBe(1);
  });

  it('back on the first step is a no-op', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'basics' }) });
    const events: string[] = [];
    component.stepBacked.subscribe(e => events.push(e));
    pick<() => void>(component, 'back').call(component);
    expect(events).toEqual([]);
  });

  it('back on a non-first step emits stepBacked with the previous step id', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'bom' }), entity: { name: 'Widget' } });
    const events: string[] = [];
    component.stepBacked.subscribe(e => events.push(e));
    pick<() => void>(component, 'back').call(component);
    expect(events).toEqual(['basics']);
  });

  it('skip on a required step is a no-op', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'basics' }) });
    const events: string[] = [];
    component.stepSkipped.subscribe(e => events.push(e));
    pick<() => void>(component, 'skip').call(component);
    expect(events).toEqual([]);
  });

  it('skip on an optional step emits stepSkipped', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'alternates' }) });
    const events: string[] = [];
    component.stepSkipped.subscribe(e => events.push(e));
    pick<() => void>(component, 'skip').call(component);
    expect(events).toEqual(['alternates']);
  });

  it('close emits closed', () => {
    const { component } = buildShell();
    let count = 0;
    component.closed.subscribe(() => count++);
    pick<() => void>(component, 'close').call(component);
    expect(count).toBe(1);
  });

  // ─── Component outlet (registry) ───────────────────────────────────

  it('currentStepComponent returns the registered component when one is registered', () => {
    const { component, registry } = buildShell({ run: buildRun({ currentStepId: 'basics' }) });
    registry.register('PartBasicsStepComponent', FakeStepComponent);
    const ctor = pick<() => unknown>(component, 'currentStepComponent')();
    expect(ctor).toBe(FakeStepComponent);
  });

  it('currentStepComponent falls back to the stub when no component is registered', () => {
    const { component } = buildShell({ run: buildRun({ currentStepId: 'basics' }) });
    const ctor = pick<() => unknown>(component, 'currentStepComponent')();
    expect(ctor).toBe(WorkflowStepStubComponent);
  });

  it('completionMap reflects passing predicates as complete', () => {
    const { component } = buildShell({
      run: buildRun({ currentStepId: 'bom' }),
      entity: { name: 'Widget', bomLines: [{ id: 1 }] },
    });
    const map = pick<() => Map<string, boolean>>(component, 'completionMap')();
    expect(map.get('basics')).toBe(true);
    expect(map.get('bom')).toBe(true);
  });

  it('completionMap reflects failing predicates as incomplete', () => {
    const { component } = buildShell({
      run: buildRun({ currentStepId: 'bom' }),
      entity: { name: 'Widget', bomLines: [] },
    });
    const map = pick<() => Map<string, boolean>>(component, 'completionMap')();
    expect(map.get('basics')).toBe(true);
    expect(map.get('bom')).toBe(false);
  });

  it('isComplete and isCurrent helpers respect the loaded entity + pointer', () => {
    const { component } = buildShell({
      run: buildRun({ currentStepId: 'bom' }),
      entity: { name: 'Widget' },
    });
    const isComplete = pick<(s: WorkflowStepDefinition) => boolean>(component, 'isComplete');
    const isCurrent = pick<(s: WorkflowStepDefinition) => boolean>(component, 'isCurrent');
    const steps = pick<() => WorkflowStepDefinition[]>(component, 'steps')();
    expect(isComplete.call(component, steps[0])).toBe(true);  // basics gate passes
    expect(isCurrent.call(component, steps[1])).toBe(true);   // bom is current
    expect(isCurrent.call(component, steps[0])).toBe(false);
  });
});
