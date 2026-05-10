import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerService } from '../../services/customer.service';
import { PortalAccessRow } from '../../models/portal-access.model';

interface PortalAccessDisplayRow extends PortalAccessRow {
  contactFullName: string;
}

@Component({
  selector: 'app-customer-portal-access-page',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    MatSlideToggleModule,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './customer-portal-access.component.html',
  styleUrl: './customer-portal-access.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPortalAccessPageComponent implements OnInit {
  private readonly service = inject(CustomerService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly rows = signal<PortalAccessDisplayRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly pendingIds = signal<Set<number>>(new Set());

  protected readonly columns: ColumnDef[] = [
    { field: 'contactFullName', header: this.translate.instant('customers.contactName'), sortable: true },
    { field: 'customerName', header: this.translate.instant('customers.title'), sortable: true },
    { field: 'contactEmail', header: this.translate.instant('common.email'), sortable: true },
    { field: 'lastLoginAt', header: this.translate.instant('customers.portalAccessPage.colLastLogin'), sortable: true, type: 'date', width: '160px' },
    { field: 'createdAt', header: this.translate.instant('customers.portalAccessPage.colCreated'), sortable: true, type: 'date', width: '140px' },
    { field: 'isEnabled', header: this.translate.instant('customers.portalAccessPage.colEnabled'), sortable: true, width: '120px', align: 'center' },
  ];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.listPortalAccess().subscribe({
      next: (data) => {
        this.rows.set(data.map(r => ({ ...r, contactFullName: `${r.contactLastName}, ${r.contactFirstName}` })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected isPending(accessId: number): boolean {
    return this.pendingIds().has(accessId);
  }

  protected onToggleEnabled(row: PortalAccessDisplayRow, enabled: boolean): void {
    const next = new Set(this.pendingIds());
    next.add(row.accessId);
    this.pendingIds.set(next);

    this.service.setPortalAccessEnabled(row.accessId, enabled).subscribe({
      next: () => {
        this.rows.update(rows => rows.map(r => r.accessId === row.accessId ? { ...r, isEnabled: enabled } : r));
        const messageKey = enabled
          ? 'customers.portalAccessPage.toggleEnabled'
          : 'customers.portalAccessPage.toggleDisabled';
        this.snackbar.success(this.translate.instant(messageKey, { name: row.contactFullName }));
        this.clearPending(row.accessId);
      },
      error: () => {
        this.clearPending(row.accessId);
      },
    });
  }

  private clearPending(accessId: number): void {
    const next = new Set(this.pendingIds());
    next.delete(accessId);
    this.pendingIds.set(next);
  }

  protected openCustomer(row: PortalAccessDisplayRow): void {
    this.router.navigate(['/customers', row.customerId, 'contacts']);
  }
}
