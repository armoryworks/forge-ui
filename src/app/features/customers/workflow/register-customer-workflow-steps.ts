import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';

import { WorkflowStepRegistryService } from '../../../shared/services/workflow-step-registry.service';
import { CustomerAddressesStepComponent } from './customer-addresses-step/customer-addresses-step.component';
import { CustomerCreditAndTaxStepComponent } from './customer-credit-and-tax-step/customer-credit-and-tax-step.component';
import { CustomerExpressFormComponent } from './customer-express-form/customer-express-form.component';
import { CustomerIdentityStepComponent } from './customer-identity-step/customer-identity-step.component';
import { CustomerReviewStepComponent } from './customer-review-step/customer-review-step.component';

/**
 * Registers the customer-feature step components into the shared workflow
 * step registry. Mirrors <c>provideVendorWorkflowSteps</c>. Wired into the
 * customers feature route so registration runs exactly once when the user
 * first enters the customers feature.
 */
export function provideCustomerWorkflowSteps(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const registry = inject(WorkflowStepRegistryService);
    registry.register('CustomerIdentityStepComponent', CustomerIdentityStepComponent);
    registry.register('CustomerAddressesStepComponent', CustomerAddressesStepComponent);
    registry.register('CustomerCreditAndTaxStepComponent', CustomerCreditAndTaxStepComponent);
    registry.register('CustomerReviewStepComponent', CustomerReviewStepComponent);
    registry.registerExpress('CustomerExpressFormComponent', CustomerExpressFormComponent);
  });
}
