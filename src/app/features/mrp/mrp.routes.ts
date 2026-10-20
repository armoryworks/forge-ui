import { Routes } from '@angular/router';
import { tabGuard } from '../../shared/guards/tab.guard';
import { MrpComponent } from './mrp.component';
import { MRP_TABS } from './models/mrp-tab.model';

export const MRP_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: ':tab', canActivate: [tabGuard(MRP_TABS, 'dashboard')], component: MrpComponent },
];
