import { Routes } from '@angular/router';
import { InventoryComponent } from './inventory.component';
import { InventoryHomeComponent } from './inventory-home/inventory-home.component';

export const INVENTORY_ROUTES: Routes = [
  // The friendly standalone-inventory home is the default landing.
  { path: '', redirectTo: 'home/kiosk', pathMatch: 'full' },
  { path: 'home', redirectTo: 'home/kiosk', pathMatch: 'full' },
  { path: 'home/:tab', component: InventoryHomeComponent },
  // The detailed / power view (stock, locations, movements, ...) stays reachable.
  { path: ':tab', component: InventoryComponent },
];
