import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { AdminService } from '../../services/admin.service';
import { AuditLogEntry } from '../../models/audit-log-entry.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-audit-log-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DataTableComponent,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    LoadingBlockDirective,
    MatPaginatorModule,
  ],
  templateUrl: './audit-log-panel.component.html',
  styleUrl: './audit-log-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPanelComponent {
  private readonly adminService = inject(AdminService);

  protected readonly isLoading = signal(false);
  protected readonly entries = signal<AuditLogEntry[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly entityTypeControl = new FormControl<string>('');
  protected readonly actionControl = new FormControl<string>('');
  protected readonly fromDateControl = new FormControl<Date | null>(null);
  protected readonly toDateControl = new FormControl<Date | null>(null);

  protected readonly entityTypeOptions: SelectOption[] = [
    { value: '', label: '-- All Types --' },
    { value: 'Job', label: 'Job' },
    { value: 'Part', label: 'Part' },
    { value: 'Customer', label: 'Customer' },
    { value: 'Vendor', label: 'Vendor' },
    { value: 'Expense', label: 'Expense' },
    { value: 'Invoice', label: 'Invoice' },
    { value: 'Payment', label: 'Payment' },
    { value: 'User', label: 'User' },
    { value: 'PurchaseOrder', label: 'Purchase Order' },
    { value: 'SalesOrder', label: 'Sales Order' },
    { value: 'Quote', label: 'Quote' },
    { value: 'Shipment', label: 'Shipment' },
    { value: 'TimeEntry', label: 'Time Entry' },
    { value: 'Asset', label: 'Asset' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'createdAt', header: 'Time', sortable: true, type: 'date', width: '140px' },
    { field: 'userName', header: 'User', sortable: true, width: '160px' },
    { field: 'action', header: 'Action', sortable: true, width: '120px' },
    { field: 'entityType', header: 'Type', sortable: true, width: '120px' },
    { field: 'entityId', header: 'ID', width: '60px', align: 'right' },
    { field: 'details', header: 'Details' },
    { field: 'ipAddress', header: 'IP', width: '130px' },
  ];

  constructor() {
    effect(() => {
      this.load();
    });

    this.entityTypeControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });
    this.actionControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });
    this.fromDateControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });
    this.toDateControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });
  }

  protected load(): void {
    this.isLoading.set(true);

    const entityType = this.entityTypeControl.value || undefined;
    const action = this.actionControl.value || undefined;
    const fromDate = this.fromDateControl.value;
    const toDate = this.toDateControl.value;

    this.adminService.getAuditLog({
      page: this.page(),
      pageSize: this.pageSize(),
      entityType,
      action,
      from: fromDate ? (toIsoDate(fromDate) ?? undefined) : undefined,
      to: toDate ? (toIsoDate(toDate) ?? undefined) : undefined,
    }).subscribe({
      next: (result) => {
        this.entries.set(result.data);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.load();
  }
}
