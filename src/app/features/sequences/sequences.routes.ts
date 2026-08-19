import { Routes } from '@angular/router';

import { SequenceDefinitionsPageComponent } from './pages/definitions/sequence-definitions-page.component';
import { SequenceDefinitionEditorComponent } from './pages/editor/sequence-definition-editor.component';
import { SequenceInstancesPageComponent } from './pages/instances/sequence-instances-page.component';

/** Gated Sequence Engine screens (CAP-CROSS-SEQUENCES). */
export const SEQUENCES_ROUTES: Routes = [
  { path: '', component: SequenceDefinitionsPageComponent },
  { path: 'new', component: SequenceDefinitionEditorComponent },
  { path: 'instances', component: SequenceInstancesPageComponent },
  { path: ':id/edit', component: SequenceDefinitionEditorComponent },
];
