import { Routes } from '@angular/router';

import { PartsComponent } from './parts.component';
import { PartWorkflowPageComponent } from './workflow/part-workflow-page/part-workflow-page.component';
import { providePartWorkflowSteps } from './workflow/register-part-workflow-steps';

/**
 * Workflow Pattern Phase 5 — `/parts` is the list, `/parts/:id` mounts the
 * workflow shell when `?workflow=...` is present (otherwise the list page's
 * detail dialog handles single-record viewing). `/parts/new` is the
 * entity-less variant used by the create-new-part flow before deferred
 * materialization stamps an entity id on the run; the page replaces the URL
 * to `/parts/{id}` once that happens.
 *
 * Step components are registered into `WorkflowStepRegistryService` exactly
 * once via the route-level `provideEnvironmentInitializer`.
 */
export const PARTS_ROUTES: Routes = [
  {
    path: '',
    providers: [providePartWorkflowSteps()],
    children: [
      { path: '', component: PartsComponent },
      { path: 'new', component: PartWorkflowPageComponent },
      { path: ':id', component: PartWorkflowPageComponent },
    ],
  },
];
