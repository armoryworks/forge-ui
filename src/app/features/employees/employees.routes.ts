import { Routes } from '@angular/router';

import { EmployeeListComponent } from './pages/employee-list/employee-list.component';
import { EmployeeDetailComponent } from './pages/employee-detail/employee-detail.component';

export const EMPLOYEES_ROUTES: Routes = [
  { path: '', component: EmployeeListComponent },
  { path: ':id', redirectTo: ':id/overview', pathMatch: 'full' },
  { path: ':id/:tab', component: EmployeeDetailComponent },
];
