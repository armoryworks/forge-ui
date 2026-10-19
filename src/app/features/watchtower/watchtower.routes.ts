import { Routes } from '@angular/router';

import { tabGuard } from '../../shared/guards/tab.guard';
import { WatchtowerComponent } from './watchtower.component';
import { WATCHTOWER_TABS } from './models/watchtower-tab.model';

export const WATCHTOWER_ROUTES: Routes = [
  { path: '', redirectTo: 'proposals', pathMatch: 'full' },
  { path: ':tab', canActivate: [tabGuard(WATCHTOWER_TABS, 'proposals')], component: WatchtowerComponent },
];
