import { Routes } from '@angular/router';
import { VendorsComponent } from './vendors.component';
import { provideVendorWorkflowSteps } from './workflow/register-vendor-workflow-steps';

/**
 * Vendors feature routes. <c>provideVendorWorkflowSteps()</c> registers
 * the per-step Angular components into the shared
 * <c>WorkflowStepRegistryService</c> so the workflow shell's
 * *ngComponentOutlet can resolve them by name. Hooked at the route level
 * (vs. the AppModule) so the registry runs exactly when the user first
 * enters the vendors feature — keeping cold-start work scoped.
 *
 * Phase C will add a <c>/vendors/new</c> route mounting the new
 * VendorWorkflowPageComponent.
 */
export const VENDORS_ROUTES: Routes = [
  {
    path: '',
    component: VendorsComponent,
    providers: [provideVendorWorkflowSteps()],
  },
];
