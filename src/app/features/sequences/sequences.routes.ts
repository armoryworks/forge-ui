import { Routes } from '@angular/router';

import { SequenceDefinitionsPageComponent } from './pages/definitions/sequence-definitions-page.component';
import { SequenceInstancesPageComponent } from './pages/instances/sequence-instances-page.component';

/** Gated Sequence Engine screens (CAP-CROSS-SEQUENCES). */
export const SEQUENCES_ROUTES: Routes = [
  { path: '', component: SequenceDefinitionsPageComponent },
  { path: 'instances', component: SequenceInstancesPageComponent },
];
