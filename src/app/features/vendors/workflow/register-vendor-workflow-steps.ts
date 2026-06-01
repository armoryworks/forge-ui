import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';

import { WorkflowStepRegistryService } from '../../../shared/services/workflow-step-registry.service';
import { VendorAddressStepComponent } from './vendor-address-step/vendor-address-step.component';
import { VendorExpressFormComponent } from './vendor-express-form/vendor-express-form.component';
import { VendorIdentityStepComponent } from './vendor-identity-step/vendor-identity-step.component';
import { VendorReviewStepComponent } from './vendor-review-step/vendor-review-step.component';
import { VendorSupplyItemsStepComponent } from './vendor-supply-items-step/vendor-supply-items-step.component';
import { VendorTermsStepComponent } from './vendor-terms-step/vendor-terms-step.component';

/**
 * Registers the vendor-feature step components into the shared workflow
 * step registry. Mirrors <c>providePartWorkflowSteps</c> — wired into the
 * vendors feature's lazy-load entry so the registration runs exactly once
 * when the user first lands on /vendors (or any route that mounts the
 * vendors feature). The shell's *ngComponentOutlet looks up component
 * constructors by the string keys the seed JSON stores in
 * <c>WorkflowSeedData.VendorWorkflowDefinitions</c>.
 */
export function provideVendorWorkflowSteps(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const registry = inject(WorkflowStepRegistryService);
    registry.register('VendorIdentityStepComponent', VendorIdentityStepComponent);
    registry.register('VendorAddressStepComponent', VendorAddressStepComponent);
    registry.register('VendorTermsStepComponent', VendorTermsStepComponent);
    registry.register('VendorSupplyItemsStepComponent', VendorSupplyItemsStepComponent);
    registry.register('VendorReviewStepComponent', VendorReviewStepComponent);
    registry.registerExpress('VendorExpressFormComponent', VendorExpressFormComponent);
  });
}
