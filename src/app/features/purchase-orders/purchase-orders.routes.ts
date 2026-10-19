import { Routes } from '@angular/router';

import { tabGuard } from '../../shared/guards/tab.guard';
import { PurchaseOrdersComponent } from './purchase-orders.component';
import { PURCHASE_ORDERS_TAB_ROLES } from './models/purchase-orders-tab-roles.model';
import { PURCHASE_ORDERS_TABS } from './models/purchase-orders-tab.model';

export const PURCHASE_ORDERS_ROUTES: Routes = [
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  {
    path: ':tab',
    canActivate: [tabGuard(PURCHASE_ORDERS_TABS, 'orders', PURCHASE_ORDERS_TAB_ROLES)],
    component: PurchaseOrdersComponent,
  },
];
