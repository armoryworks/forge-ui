import { Routes } from '@angular/router';

import { authGuard } from '../../shared/guards/auth.guard';
import { ShopFloorDisplayComponent } from './shop-floor-display.component';

export const SHOP_FLOOR_ROUTES: Routes = [
  { path: '', component: ShopFloorDisplayComponent },
  // Inert, mock-data preview of the shop floor for interactive training. Behind
  // authGuard (only a signed-in trainee reaches it) and flagged via static route
  // data — the real kiosk route above never carries `preview`, so its
  // clear-on-entry stays unconditional. The preview renders mock data and makes
  // no auth/backend/mutation calls (see ShopFloorDisplayComponent.previewMode).
  { path: 'preview', component: ShopFloorDisplayComponent, canActivate: [authGuard], data: { preview: true } },
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
