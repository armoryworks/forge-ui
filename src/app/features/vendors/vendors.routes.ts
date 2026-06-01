import { Routes } from '@angular/router';
import { VendorsComponent } from './vendors.component';
import { provideVendorWorkflowSteps } from './workflow/register-vendor-workflow-steps';

/**
 * Vendors feature routes.
 *
 *   • <c>/vendors</c>                            — list page
 *   • <c>/vendors/new?workflow=vendor-guided-v1</c>  — entity-less workflow,
 *     deferred materialization stamps a vendor id then URL-upgrades to
 *     <c>/vendors/{id}</c>
 *   • <c>/vendors/:id?workflow=vendor-guided-v1</c> — resume / re-enter
 *     an active run for an existing vendor
 *
 * <c>provideVendorWorkflowSteps()</c> hooks the per-step Angular components
 * into the shared <c>WorkflowStepRegistryService</c> so the workflow shell
 * can resolve them by name. Registered at the feature route level so the
 * registration runs exactly when the user first enters the vendors feature
 * (cold-start scope), not at AppModule bootstrap.
 *
 * The workflow page is lazy-loaded to keep the list-page route lean — the
 * workflow shell + step components are ~2k LOC that only loads when the
 * user actually starts a new vendor.
 */
export const VENDORS_ROUTES: Routes = [
  {
    path: '',
    component: VendorsComponent,
    providers: [provideVendorWorkflowSteps()],
  },
  {
    path: 'new',
    providers: [provideVendorWorkflowSteps()],
    loadComponent: () =>
      import('./workflow/vendor-workflow-page/vendor-workflow-page.component')
        .then((m) => m.VendorWorkflowPageComponent),
  },
  {
    path: ':id',
    providers: [provideVendorWorkflowSteps()],
    loadComponent: () =>
      import('./workflow/vendor-workflow-page/vendor-workflow-page.component')
        .then((m) => m.VendorWorkflowPageComponent),
  },
];
