import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
    ReactiveFormsModule, DatePipe, TranslatePipe,
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
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly employees = signal<EmployeeListItem[]>([]);

  protected readonly searchControl = new FormControl('');
  protected readonly roleControl = new FormControl<string | null>(null);
  protected readonly statusControl = new FormControl<boolean | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly roleOptions = signal<SelectOption[]>([{ value: null, label: '-- All Roles --' }]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('employees.filters.all') },
    { value: true, label: this.translate.instant('employees.filters.active') },
    { value: false, label: this.translate.instant('employees.filters.inactive') },
  ];

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'name', header: this.translate.instant('employees.cols.name'), sortable: true },
    { field: 'role', header: this.translate.instant('employees.cols.role'), sortable: true, filterable: true, type: 'enum' as const,
      filterOptions: this.roleOptions().filter(o => o.value !== null), width: '130px' },
    { field: 'teamName', header: this.translate.instant('employees.cols.team'), sortable: true, width: '120px' },
    { field: 'jobTitle', header: this.translate.instant('employees.cols.title'), sortable: true, width: '140px' },
    { field: 'email', header: this.translate.instant('employees.cols.email'), sortable: true },
    { field: 'phone', header: this.translate.instant('employees.cols.phone'), sortable: true, width: '130px' },
    { field: 'isActive', header: this.translate.instant('employees.cols.status'), sortable: true, width: '80px' },
    { field: 'startDate', header: this.translate.instant('employees.cols.startDate'), sortable: true, type: 'date' as const, width: '100px' },
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
