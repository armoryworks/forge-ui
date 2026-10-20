import { Routes } from '@angular/router';
import { InventoryComponent } from './inventory.component';
import { InventoryHomeComponent } from './inventory-home/inventory-home.component';
import { tabGuard } from '../../shared/guards/tab.guard';
import { INVENTORY_HOME_TABS } from './models/inventory-home-tab.model';
import { INVENTORY_TAB_ROLES } from './models/inventory-tab-roles.model';
import { INVENTORY_TABS } from './models/inventory-tab.model';

export const INVENTORY_ROUTES: Routes = [
  // The friendly standalone-inventory home is the default landing.
  { path: '', redirectTo: 'home/kiosk', pathMatch: 'full' },
  { path: 'home', redirectTo: 'home/kiosk', pathMatch: 'full' },
  { path: 'home/:tab', canActivate: [tabGuard(INVENTORY_HOME_TABS, 'kiosk')], component: InventoryHomeComponent },
  // The detailed / power view (stock, locations, movements, ...) stays reachable.
  { path: ':tab', canActivate: [tabGuard(INVENTORY_TABS, 'stock', INVENTORY_TAB_ROLES)], component: InventoryComponent },
];
