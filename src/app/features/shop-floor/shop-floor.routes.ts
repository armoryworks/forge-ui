import { Routes } from '@angular/router';

import { ShopFloorDisplayComponent } from './shop-floor-display.component';

export const SHOP_FLOOR_ROUTES: Routes = [
  { path: '', component: ShopFloorDisplayComponent },
  {
    path: 'clock',
    loadComponent: () =>
      import('./clock/shop-floor-clock.component').then((m) => m.ShopFloorClockComponent),
  },
  {
    path: 'scan',
    loadComponent: () =>
      import('./scan/inventory-scan.component').then((m) => m.InventoryScanComponent),
  },
  {
    path: 'scan-log',
    loadComponent: () =>
      import('./components/scan-daily-log/scan-daily-log.component').then((m) => m.ScanDailyLogComponent),
  },
];
