import { Routes } from '@angular/router';
import { KanbanComponent } from './kanban.component';
import { JOB_IMPORT_ROLES } from './job-roles';
import { roleGuard } from '../../shared/guards/role.guard';
import { capabilityGuard } from '../../shared/guards/capability.guard';

export const KANBAN_ROUTES: Routes = [
  {
    path: 'import',
    data: { titleKey: 'jobImport.title' },
    canActivate: [roleGuard(...JOB_IMPORT_ROLES), capabilityGuard('CAP-CROSS-INTEG-FILE', 'CAP-MFG-WO-RELEASE')],
    loadComponent: () => import('./pages/import/job-import.component').then(m => m.JobImportPageComponent),
  },
  { path: '', component: KanbanComponent },
];
