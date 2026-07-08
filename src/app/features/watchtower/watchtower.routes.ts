import { Routes } from '@angular/router';

import { WatchtowerComponent } from './watchtower.component';

export const WATCHTOWER_ROUTES: Routes = [
  { path: '', redirectTo: 'proposals', pathMatch: 'full' },
  { path: ':tab', component: WatchtowerComponent },
];
