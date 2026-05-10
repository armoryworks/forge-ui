import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CustomerService } from '../../services/customer.service';
import { FlatContactRow } from '../../models/flat-contact.model';

@Component({
  selector: 'app-customer-contacts-page',
  standalone: true,
  imports: [
    TranslatePipe,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './customer-contacts.component.html',
  styleUrl: './customer-contacts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerContactsPageComponent implements OnInit {
  private readonly service = inject(CustomerService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly displayRows = signal<(FlatContactRow & { fullName: string })[]>([]);
  protected readonly loading = signal(true);

  protected readonly columns: ColumnDef[] = [
    { field: 'fullName', header: this.translate.instant('customers.contactName'), sortable: true },
    { field: 'customerName', header: this.translate.instant('customers.title'), sortable: true },
    { field: 'role', header: this.translate.instant('customers.role'), sortable: true, width: '120px' },
    { field: 'email', header: this.translate.instant('common.email'), sortable: true },
    { field: 'phone', header: this.translate.instant('common.phone'), sortable: true, width: '140px' },
    { field: 'suppression', header: this.translate.instant('leads.suppression.colChannels'), width: '180px' },
    { field: 'isPrimary', header: this.translate.instant('customers.primary'), sortable: true, width: '80px' },
  ];

  ngOnInit(): void {
    this.service.getAllContactsFlat().subscribe({
      next: (data) => {
        this.displayRows.set(data.map(r => ({ ...r, fullName: `${r.lastName}, ${r.firstName}` })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCustomer(row: FlatContactRow): void {
    this.router.navigate(['/customers', row.customerId, 'contacts']);
  }
}
