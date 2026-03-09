import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { CustomerService } from './services/customer.service';
import { CustomerListItem } from './models/customer-list-item.model';
import { CustomerDetail } from './models/customer-detail.model';
import { Contact } from './models/contact.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, ToggleComponent,
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective,
    AvatarComponent,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent {
  private readonly customerService = inject(CustomerService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  protected readonly selectedCustomer = signal<CustomerDetail | null>(null);
  protected readonly activeTab = signal<'info' | 'contacts' | 'jobs'>('info');

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly activeFilterControl = new FormControl<boolean | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly activeOptions: SelectOption[] = [
    { value: null, label: 'All' },
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
  ];

  // Customer Dialog
  protected readonly showDialog = signal(false);
  protected readonly editingCustomer = signal<CustomerDetail | null>(null);
  protected readonly customerForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    companyName: new FormControl(''),
    email: new FormControl('', [Validators.email]),
    phone: new FormControl(''),
  });

  protected readonly customerViolations = FormValidationService.getViolations(this.customerForm, {
    name: 'Name',
    companyName: 'Company Name',
    email: 'Email',
    phone: 'Phone',
  });

  // Contact Dialog
  protected readonly showContactDialog = signal(false);
  protected readonly editingContact = signal<Contact | null>(null);
  protected readonly contactForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.email]),
    phone: new FormControl(''),
    role: new FormControl(''),
    isPrimary: new FormControl(false),
  });

  protected readonly contactViolations = FormValidationService.getViolations(this.contactForm, {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    role: 'Role',
  });

  protected readonly roleOptions: SelectOption[] = [
    { value: '', label: '-- None --' },
    { value: 'Owner', label: 'Owner' },
    { value: 'Manager', label: 'Manager' },
    { value: 'Engineer', label: 'Engineer' },
    { value: 'Procurement', label: 'Procurement' },
    { value: 'Billing', label: 'Billing' },
    { value: 'Shipping', label: 'Shipping' },
  ];

  // Table
  protected readonly customerColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'companyName', header: 'Company', sortable: true },
    { field: 'email', header: 'Email', sortable: true },
    { field: 'phone', header: 'Phone', sortable: true },
    { field: 'isActive', header: 'Active', sortable: true, type: 'enum', filterable: true, filterOptions: [
      { value: true, label: 'Active' }, { value: false, label: 'Inactive' },
    ], width: '80px' },
    { field: 'contactCount', header: 'Contacts', sortable: true, width: '90px', align: 'center' },
    { field: 'jobCount', header: 'Jobs', sortable: true, width: '70px', align: 'center' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly customerRowClass = (row: unknown) => {
    const c = row as CustomerListItem;
    return c.id === this.selectedCustomer()?.id ? 'row--selected' : '';
  };

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
    this.customerService.getCustomerById(item.id).subscribe({
      next: (detail) => { this.selectedCustomer.set(detail); this.activeTab.set('info'); },
    });
  }

  protected closeDetail(): void { this.selectedCustomer.set(null); }

  // ─── Customer CRUD ───
  protected openCreateCustomer(): void {
    this.editingCustomer.set(null);
    this.customerForm.reset({ name: '', companyName: '', email: '', phone: '' });
    this.showDialog.set(true);
  }

  protected openEditCustomer(): void {
    const c = this.selectedCustomer();
    if (!c) return;
    this.editingCustomer.set(c);
    this.customerForm.patchValue({
      name: c.name,
      companyName: c.companyName ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected saveCustomer(): void {
    if (this.customerForm.invalid) return;
    this.saving.set(true);
    const form = this.customerForm.getRawValue();
    const editing = this.editingCustomer();

    if (editing) {
      this.customerService.updateCustomer(editing.id, {
        name: form.name || undefined,
        companyName: form.companyName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeDialog();
          this.loadCustomers();
          this.customerService.getCustomerById(editing.id).subscribe(d => this.selectedCustomer.set(d));
          this.snackbar.success('Customer updated.');
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.customerService.createCustomer({
        name: form.name!,
        companyName: form.companyName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      }).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.closeDialog();
          this.loadCustomers();
          this.selectCustomer(created);
          this.snackbar.success('Customer created.');
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected toggleActive(): void {
    const c = this.selectedCustomer();
    if (!c) return;
    this.customerService.updateCustomer(c.id, { isActive: !c.isActive }).subscribe({
      next: () => {
        this.customerService.getCustomerById(c.id).subscribe(d => this.selectedCustomer.set(d));
        this.loadCustomers();
        this.snackbar.success(c.isActive ? 'Customer deactivated.' : 'Customer activated.');
      },
    });
  }

  protected deleteCustomer(): void {
    const c = this.selectedCustomer();
    if (!c) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Customer?',
        message: `This will remove "${c.name}" from the system. This action cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.deleteCustomer(c.id).subscribe({
        next: () => {
          this.selectedCustomer.set(null);
          this.loadCustomers();
          this.snackbar.success('Customer deleted.');
        },
      });
    });
  }

  // ─── Contact CRUD ───
  protected openCreateContact(): void {
    this.editingContact.set(null);
    this.contactForm.reset({ firstName: '', lastName: '', email: '', phone: '', role: '', isPrimary: false });
    this.showContactDialog.set(true);
  }

  protected openEditContact(contact: Contact): void {
    this.editingContact.set(contact);
    this.contactForm.patchValue({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      role: contact.role ?? '',
      isPrimary: contact.isPrimary,
    });
    this.showContactDialog.set(true);
  }

  protected closeContactDialog(): void { this.showContactDialog.set(false); }

  protected saveContact(): void {
    if (this.contactForm.invalid) return;
    const c = this.selectedCustomer();
    if (!c) return;

    this.saving.set(true);
    const form = this.contactForm.getRawValue();
    const editing = this.editingContact();

    if (editing) {
      this.customerService.updateContact(c.id, editing.id, {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role || undefined,
        isPrimary: form.isPrimary ?? undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeContactDialog();
          this.refreshDetail(c.id);
          this.snackbar.success('Contact updated.');
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.customerService.createContact(c.id, {
        firstName: form.firstName!,
        lastName: form.lastName!,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role || undefined,
        isPrimary: form.isPrimary ?? false,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeContactDialog();
          this.refreshDetail(c.id);
          this.loadCustomers();
          this.snackbar.success('Contact created.');
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected deleteContact(contact: Contact): void {
    const c = this.selectedCustomer();
    if (!c) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Contact?',
        message: `Remove "${contact.firstName} ${contact.lastName}" from this customer?`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.deleteContact(c.id, contact.id).subscribe({
        next: () => {
          this.refreshDetail(c.id);
          this.loadCustomers();
          this.snackbar.success('Contact removed.');
        },
      });
    });
  }

  // ─── Helpers ───
  protected getInitials(contact: Contact): string {
    return (contact.firstName[0] + contact.lastName[0]).toUpperCase();
  }

  private refreshDetail(customerId: number): void {
    this.customerService.getCustomerById(customerId).subscribe(d => this.selectedCustomer.set(d));
  }
}
