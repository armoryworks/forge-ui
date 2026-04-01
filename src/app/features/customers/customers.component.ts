import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerService } from './services/customer.service';
import { CustomerListItem } from './models/customer-list-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent {
  private readonly customerService = inject(CustomerService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly activeFilterControl = new FormControl<boolean | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly activeOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.all') },
    { value: true, label: this.translate.instant('common.active') },
    { value: false, label: this.translate.instant('common.inactive') },
  ];

  // Customer Create Dialog
  protected readonly showDialog = signal(false);
  protected readonly customerForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    companyName: new FormControl(''),
    email: new FormControl('', [Validators.email]),
    phone: new FormControl(''),
  });

  protected readonly customerViolations = computed(() =>
    FormValidationService.getViolations(this.customerForm, {
      name: this.translate.instant('common.name'),
      companyName: this.translate.instant('customers.companyName'),
      email: this.translate.instant('common.email'),
      phone: this.translate.instant('common.phone'),
    })
  );

  // Table
  protected readonly customerColumns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('customers.colName'), sortable: true },
    { field: 'companyName', header: this.translate.instant('customers.colCompany'), sortable: true },
    { field: 'email', header: this.translate.instant('customers.colEmail'), sortable: true },
    { field: 'phone', header: this.translate.instant('customers.colPhone'), sortable: true },
    { field: 'isActive', header: this.translate.instant('customers.colActive'), sortable: true, type: 'enum', filterable: true, filterOptions: [
      { value: true, label: this.translate.instant('common.active') }, { value: false, label: this.translate.instant('common.inactive') },
    ], width: '80px' },
    { field: 'contactCount', header: this.translate.instant('customers.colContacts'), sortable: true, width: '90px', align: 'center' },
    { field: 'jobCount', header: this.translate.instant('customers.colJobs'), sortable: true, width: '70px', align: 'center' },
    { field: 'createdAt', header: this.translate.instant('customers.colCreated'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.loadCustomers();
  }

  protected loadCustomers(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const isActive = this.activeFilterControl.value ?? undefined;
    this.customerService.getCustomers(search, isActive).subscribe({
      next: (list) => { this.customers.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadCustomers(); }

  protected selectCustomer(item: CustomerListItem): void {
    this.router.navigate(['/customers', item.id]);
  }

  // ─── Customer Create ───
  protected openCreateCustomer(): void {
    this.customerForm.reset({ name: '', companyName: '', email: '', phone: '' });
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected saveCustomer(): void {
    if (this.customerForm.invalid) return;
    this.saving.set(true);
    const form = this.customerForm.getRawValue();

    this.customerService.createCustomer({
      name: form.name!,
      companyName: form.companyName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
    }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.closeDialog();
        this.snackbar.success(this.translate.instant('customers.customerCreated'));
        this.router.navigate(['/customers', created.id]);
      },
      error: () => this.saving.set(false),
    });
  }
}
