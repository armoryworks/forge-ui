import { Routes } from '@angular/router';
import { CustomersComponent } from './customers.component';
import { CustomerDetailComponent } from './pages/customer-detail/customer-detail.component';

export const CUSTOMERS_ROUTES: Routes = [
  { path: '', component: CustomersComponent },
  { path: ':id', redirectTo: ':id/overview', pathMatch: 'full' },
  { path: ':id/:tab', component: CustomerDetailComponent },
];
