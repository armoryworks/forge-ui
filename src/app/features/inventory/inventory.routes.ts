import { Routes } from '@angular/router';
import { InventoryComponent } from './inventory.component';
import { InventoryHomeComponent } from './inventory-home/inventory-home.component';
import { tabGuard } from '../../shared/guards/tab.guard';
import { capabilityGuard } from '../../shared/guards/capability.guard';
import { roleGuard } from '../../shared/guards/role.guard';
import { INVENTORY_HOME_TABS } from './models/inventory-home-tab.model';
import { INVENTORY_TAB_ROLES } from './models/inventory-tab-roles.model';
import { INVENTORY_TABS } from './models/inventory-tab.model';

export const INVENTORY_ROUTES: Routes = [
  // The friendly standalone-inventory home is the default landing.
  { path: '', redirectTo: 'home/kiosk', pathMatch: 'full' },
  { path: 'home', redirectTo: 'home/kiosk', pathMatch: 'full' },
  { path: 'home/:tab', canActivate: [tabGuard(INVENTORY_HOME_TABS, 'kiosk')], component: InventoryHomeComponent },
  {
    path: 'physical-inventory',
    data: { titleKey: 'nav.physicalInventory' },
    canActivate: [capabilityGuard('CAP-INV-PHYSICAL')],
    loadComponent: () => import('./physical-inventory/physical-inventory-list/physical-inventory-list.component')
      .then(m => m.PhysicalInventoryListComponent),
  },
  {
    path: 'physical-inventory/:id',
    data: { titleKey: 'nav.physicalInventory' },
    canActivate: [capabilityGuard('CAP-INV-PHYSICAL')],
    loadComponent: () => import('./physical-inventory/physical-inventory-detail/physical-inventory-detail.component')
      .then(m => m.PhysicalInventoryDetailComponent),
  },
  {
    path: 'consignment',
    data: { titleKey: 'nav.consignment' },
    canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager', 'Engineer'), capabilityGuard('CAP-MD-CONTRACTS-CONSIGNMENT')],
    loadComponent: () => import('./consignment/consignment-agreements/consignment-agreements.component')
      .then(m => m.ConsignmentAgreementsComponent),
  },
  // The detailed / power view (stock, locations, movements, ...) stays reachable.
  { path: ':tab', canActivate: [tabGuard(INVENTORY_TABS, 'stock', INVENTORY_TAB_ROLES)], component: InventoryComponent },
];
