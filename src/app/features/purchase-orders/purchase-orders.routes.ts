import { Routes } from '@angular/router';

import { PurchaseOrdersComponent } from './purchase-orders.component';

export const PURCHASE_ORDERS_ROUTES: Routes = [
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  { path: ':tab', component: PurchaseOrdersComponent },
];
