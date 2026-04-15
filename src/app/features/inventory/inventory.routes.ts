import { Routes } from '@angular/router';
import { InventoryComponent } from './inventory.component';

export const INVENTORY_ROUTES: Routes = [
  { path: '', redirectTo: 'stock', pathMatch: 'full' },
  { path: ':tab', component: InventoryComponent },
];
