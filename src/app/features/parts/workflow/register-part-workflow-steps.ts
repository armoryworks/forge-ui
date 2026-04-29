import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';

import { WorkflowStepRegistryService } from '../../../shared/services/workflow-step-registry.service';
import { PartAlternatesStepComponent } from './part-alternates-step/part-alternates-step.component';
import { PartBasicsStepComponent } from './part-basics-step/part-basics-step.component';
import { PartBomStepComponent } from './part-bom-step/part-bom-step.component';
import { PartCostingStepComponent } from './part-costing-step/part-costing-step.component';
import { PartExpressFormComponent } from './part-express-form/part-express-form.component';
import { PartRoutingStepComponent } from './part-routing-step/part-routing-step.component';

/**
 * Workflow Pattern Phase 5 — Registers the per-entity step components for
 * the Part workflow definitions (`part-assembly-guided-v1`,
 * `part-raw-material-express-v1`) into the shell's
 * {@link WorkflowStepRegistryService}.
 *
 * Wired into the parts feature's lazy-load entry via
 * `provideEnvironmentInitializer` so the registration runs exactly once when
 * the user first lands on `/parts` (or any route that mounts the parts
 * feature). The shell's *ngComponentOutlet looks up component constructors
 * by the same string keys the seed JSON stores.
 */
export function providePartWorkflowSteps(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const registry = inject(WorkflowStepRegistryService);
    registry.register('PartBasicsStepComponent', PartBasicsStepComponent);
    registry.register('PartBomStepComponent', PartBomStepComponent);
    registry.register('PartRoutingStepComponent', PartRoutingStepComponent);
    registry.register('PartCostingStepComponent', PartCostingStepComponent);
    registry.register('PartAlternatesStepComponent', PartAlternatesStepComponent);
    registry.registerExpress('PartExpressFormComponent', PartExpressFormComponent);
  });
}
