import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeListItem } from '../../models/employee.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    AvatarComponent,
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeListComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly employees = signal<EmployeeListItem[]>([]);

  protected readonly searchControl = new FormControl('');
  protected readonly roleControl = new FormControl<string | null>(null);
  protected readonly statusControl = new FormControl<boolean | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly roleOptions = signal<SelectOption[]>([{ value: null, label: '-- All Roles --' }]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: '-- All --' },
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
  ];

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'role', header: 'Role', sortable: true, filterable: true, type: 'enum' as const,
      filterOptions: this.roleOptions().filter(o => o.value !== null), width: '130px' },
    { field: 'teamName', header: 'Team', sortable: true, width: '120px' },
    { field: 'jobTitle', header: 'Title', sortable: true, width: '140px' },
    { field: 'email', header: 'Email', sortable: true },
    { field: 'phone', header: 'Phone', sortable: true, width: '130px' },
    { field: 'isActive', header: 'Status', sortable: true, width: '80px' },
    { field: 'startDate', header: 'Start Date', sortable: true, type: 'date' as const, width: '100px' },
  ]);

  constructor() {
    this.refDataService.getRolesAsOptions('-- All Roles --').subscribe(opts => this.roleOptions.set(opts));
    this.loadEmployees();
  }

  protected loadEmployees(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const role = this.roleControl.value ?? undefined;
    const isActive = this.statusControl.value ?? undefined;
    this.employeeService.getEmployees({ search, role, isActive }).subscribe({
      next: list => { this.employees.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadEmployees(); }

  protected selectEmployee(item: EmployeeListItem): void {
    this.router.navigate(['/employees', item.id]);
  }

  protected formatName(item: EmployeeListItem): string {
    return `${item.lastName}, ${item.firstName}`;
  }
}
