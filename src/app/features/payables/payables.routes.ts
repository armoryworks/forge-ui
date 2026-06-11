import { Routes } from '@angular/router';
import { PayablesComponent } from './payables.component';

export const PAYABLES_ROUTES: Routes = [
  { path: '', redirectTo: 'bills', pathMatch: 'full' },
  { path: ':tab', component: PayablesComponent },
];
