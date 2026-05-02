import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';

import { WorkflowStepRegistryService } from '../../../shared/services/workflow-step-registry.service';
import { PartAlternatesStepComponent } from './part-alternates-step/part-alternates-step.component';
import { PartBasicsStepComponent } from './part-basics-step/part-basics-step.component';
import { PartBomStepComponent } from './part-bom-step/part-bom-step.component';
import { PartCostingStepComponent } from './part-costing-step/part-costing-step.component';
import { PartExpressFormComponent } from './part-express-form/part-express-form.component';
import { PartFlagsStepComponent } from './part-flags-step/part-flags-step.component';
import { PartInventoryStepComponent } from './part-inventory-step/part-inventory-step.component';
import { PartQualityStepComponent } from './part-quality-step/part-quality-step.component';
import { PartRoutingStepComponent } from './part-routing-step/part-routing-step.component';
import { PartSalesHooksStepComponent } from './part-sales-hooks-step/part-sales-hooks-step.component';
import { PartShippingStepComponent } from './part-shipping-step/part-shipping-step.component';
import { PartSourcePartStepComponent } from './part-source-part-step/part-source-part-step.component';
import { PartSourcingStepComponent } from './part-sourcing-step/part-sourcing-step.component';
import { PartToolAssetStepComponent } from './part-tool-asset-step/part-tool-asset-step.component';
import { PartVendorPartsStepComponent } from './part-vendor-parts-step/part-vendor-parts-step.component';
import { PartVendorStepComponent } from './part-vendor-step/part-vendor-step.component';

/**
 * Workflow Pattern Phase 5 — Registers the per-entity step components for
 * the Part workflow definitions into the shell's
 * {@link WorkflowStepRegistryService}.
 *
 * Wired into the parts feature's lazy-load entry via
 * `provideEnvironmentInitializer` so the registration runs exactly once when
 * the user first lands on `/parts` (or any route that mounts the parts
 * feature). The shell's *ngComponentOutlet looks up component constructors
 * by the same string keys the seed JSON stores.
 *
 * Pillar 6 follow-up — Adds the 10 combo-specific step components that the
 * 14-combo seed introduced (Sourcing, Manufacturer, Inventory, Quality,
 * Shipping, ToolAsset, SourcePart, Vendor, Flags, SalesHooks).
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
    // Phase 6 — also register the express form as a step component. The
    // `part-raw-material-express-v1` definition has a single 'all' step
    // whose `componentName` is `PartExpressFormComponent`; when a user
    // overrides Q2 mode to Step-by-step on a raw-material part, the
    // guided rail mounts the per-step component for 'all', which is the
    // express form. Same Type registration, two slots in the registry.
    registry.register('PartExpressFormComponent', PartExpressFormComponent);

    // Pillar 6 follow-up — combo-specific step components. Pre-beta:
    // PartManufacturerStepComponent was retired when OEM identity moved
    // off Part onto VendorPart; the new PartVendorPartsStepComponent
    // (post-Sourcing) is its replacement and captures manufacturer name,
    // mfr PN, vendor SKU, and pricing per (Part, Vendor) row.
    registry.register('PartSourcingStepComponent', PartSourcingStepComponent);
    registry.register('PartVendorPartsStepComponent', PartVendorPartsStepComponent);
    registry.register('PartInventoryStepComponent', PartInventoryStepComponent);
    registry.register('PartQualityStepComponent', PartQualityStepComponent);
    registry.register('PartShippingStepComponent', PartShippingStepComponent);
    registry.register('PartToolAssetStepComponent', PartToolAssetStepComponent);
    registry.register('PartSourcePartStepComponent', PartSourcePartStepComponent);
    registry.register('PartVendorStepComponent', PartVendorStepComponent);
    registry.register('PartFlagsStepComponent', PartFlagsStepComponent);
    registry.register('PartSalesHooksStepComponent', PartSalesHooksStepComponent);
  });
}
