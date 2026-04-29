import { Routes } from '@angular/router';

import { PartsComponent } from './parts.component';
import { PartWorkflowPageComponent } from './workflow/part-workflow-page/part-workflow-page.component';
import { providePartWorkflowSteps } from './workflow/register-part-workflow-steps';

/**
 * Workflow Pattern Phase 5 — `/parts` is the list, `/parts/:id` mounts the
 * workflow shell when `?workflow=...` is present (otherwise the list page's
 * detail dialog handles single-record viewing).
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
      { path: ':id', component: PartWorkflowPageComponent },
    ],
  },
];
