import { Routes } from '@angular/router';

import { LoadingDemoComponent } from './loading-demo.component';

export const DEV_TOOLS_ROUTES: Routes = [
  { path: '', redirectTo: 'loading', pathMatch: 'full' },
  { path: 'loading', component: LoadingDemoComponent },
];
