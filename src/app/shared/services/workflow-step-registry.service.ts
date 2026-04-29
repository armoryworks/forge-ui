import { Injectable, Type } from '@angular/core';

/**
 * Workflow Pattern Phase 4 — Step component registry.
 *
 * Maps `WorkflowDefinition.steps[].componentName` (a stable string the DB
 * stores) to a concrete Angular component class. Per-entity feature modules
 * register their step components on import (or on a route's bootstrap
 * effect) so the shell stays generic — it never imports a part-specific
 * step component itself.
 *
 * Usage from a feature module:
 * ```typescript
 * private readonly registry = inject(WorkflowStepRegistryService);
 * constructor() {
 *   this.registry.register('PartBasicsStepComponent', PartBasicsStepComponent);
 *   this.registry.register('PartBomStepComponent', PartBomStepComponent);
 * }
 * ```
 *
 * Usage from the shell:
 * ```typescript
 * const ctor = this.registry.get(stepDef.componentName);
 * <ng-container *ngComponentOutlet="ctor" />
 * ```
 *
 * If the component name is unknown, the shell falls back to the stub.
 * This is intentional during phased rollout — Phase 4 ships the shell,
 * Phase 5 wires the per-entity components, but the shell can mount
 * end-to-end with stubs in the meantime.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowStepRegistryService {
  private readonly registry = new Map<string, Type<unknown>>();
  private readonly expressRegistry = new Map<string, Type<unknown>>();

  register(componentName: string, ctor: Type<unknown>): void {
    this.registry.set(componentName, ctor);
  }

  registerExpress(componentName: string, ctor: Type<unknown>): void {
    this.expressRegistry.set(componentName, ctor);
  }

  /** Returns the registered ctor, or `null` if the name isn't known. */
  get(componentName: string | null | undefined): Type<unknown> | null {
    if (!componentName) return null;
    return this.registry.get(componentName) ?? null;
  }

  getExpress(componentName: string | null | undefined): Type<unknown> | null {
    if (!componentName) return null;
    return this.expressRegistry.get(componentName) ?? null;
  }

  /** Test-only / hot-reload helper. */
  clear(): void {
    this.registry.clear();
    this.expressRegistry.clear();
  }
}
