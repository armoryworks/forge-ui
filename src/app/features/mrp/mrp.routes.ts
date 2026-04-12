import { Routes } from '@angular/router';
import { MrpComponent } from './mrp.component';

export const MRP_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: ':tab', component: MrpComponent },
];
