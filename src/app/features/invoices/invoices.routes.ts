import { Routes } from '@angular/router';
import { InvoicesComponent } from './invoices.component';
import { INVOICE_IMPORT_ROLES } from './invoice-import-roles';
import { roleGuard } from '../../shared/guards/role.guard';
import { capabilityGuard } from '../../shared/guards/capability.guard';

export const INVOICES_ROUTES: Routes = [
  {
    path: 'import',
    data: { titleKey: 'invoiceImport.title' },
    canActivate: [roleGuard(...INVOICE_IMPORT_ROLES), capabilityGuard('CAP-CROSS-INTEG-FILE', 'CAP-O2C-INVOICE')],
    loadComponent: () => import('./pages/import/invoice-import.component').then(m => m.InvoiceImportPageComponent),
  },
  { path: '', component: InvoicesComponent },
];
