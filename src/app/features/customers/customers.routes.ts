import { Routes } from '@angular/router';
import { CustomersComponent } from './customers.component';
import { CustomerDetailComponent } from './pages/customer-detail/customer-detail.component';
import { provideCustomerWorkflowSteps } from './workflow/register-customer-workflow-steps';

/**
 * Phase 1r / Batch 3 — Customers becomes a sub-route hub matching the
 * shape Leads got in Batch 2. Same submenu pattern; different children
 * because customer work is *management* (account oversight) rather than
 * *acquisition* (bulk pipelines).
 *
 * Order matters: literal sub-paths must precede `:id` so that
 * `/customers/contacts` resolves to the contacts page, not to a customer
 * with id "contacts". The bare `/customers` path keeps resolving to the
 * existing list (cross-entity links + bookmarks unaffected).
 *
 * Stub pages this batch; real implementations land as the workflow
 * needs surface — flat cross-customer contact view, portal-access
 * admin, saved segments, bulk import.
 */
export const CUSTOMERS_ROUTES: Routes = [
  { path: '', component: CustomersComponent, providers: [provideCustomerWorkflowSteps()] },
  {
    path: 'contacts',
    loadComponent: () =>
      import('./pages/contacts/customer-contacts.component')
        .then(m => m.CustomerContactsPageComponent),
  },
  {
    path: 'portal-access',
    loadComponent: () =>
      import('./pages/portal-access/customer-portal-access.component')
        .then(m => m.CustomerPortalAccessPageComponent),
  },
  {
    path: 'segments',
    loadComponent: () =>
      import('./pages/segments/customer-segments.component')
        .then(m => m.CustomerSegmentsPageComponent),
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./pages/import/customer-import.component')
        .then(m => m.CustomerImportPageComponent),
  },
  // Detail-page routes stay last; the dynamic :id matches anything
  // that didn't hit a literal path above.
  { path: ':id', redirectTo: ':id/overview', pathMatch: 'full' },
  { path: ':id/:tab', component: CustomerDetailComponent },
];
