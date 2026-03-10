import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { VendorService } from './services/vendor.service';
import { VendorListItem } from './models/vendor-list-item.model';
import { VendorDetail } from './models/vendor-detail.model';
import { VendorDialogComponent } from './components/vendor-dialog/vendor-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    VendorDialogComponent, EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsComponent {
  private readonly vendorService = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly vendors = signal<VendorListItem[]>([]);
  protected readonly selectedVendor = signal<VendorDetail | null>(null);
  protected readonly activeTab = signal<'info' | 'purchase-orders'>('info');

  // Dialog
  protected readonly showDialog = signal(false);
  protected readonly editingVendor = signal<VendorDetail | null>(null);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly activeFilterControl = new FormControl<boolean | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly activeOptions: SelectOption[] = [
    { value: null, label: 'All' },
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
  ];

  protected readonly vendorColumns: ColumnDef[] = [
    { field: 'companyName', header: 'Company Name', sortable: true },
    { field: 'contactName', header: 'Contact', sortable: true },
    { field: 'email', header: 'Email', sortable: true },
    { field: 'phone', header: 'Phone', sortable: true },
    { field: 'isActive', header: 'Active', sortable: true, type: 'enum', filterable: true, filterOptions: [
      { value: true, label: 'Active' }, { value: false, label: 'Inactive' },
    ], width: '80px' },
    { field: 'poCount', header: 'POs', sortable: true, width: '70px', align: 'center' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly vendorRowClass = (row: unknown) => {
    const v = row as VendorListItem;
    return v.id === this.selectedVendor()?.id ? 'row--selected' : '';
  };

  protected readonly poColumns: ColumnDef[] = [
    { field: 'poNumber', header: 'PO #', sortable: true, width: '120px' },
    { field: 'status', header: 'Status', sortable: true, width: '140px' },
    { field: 'lineCount', header: 'Lines', sortable: true, width: '70px', align: 'center' },
    { field: 'expectedDeliveryDate', header: 'Expected', sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.loadVendors();
  }

  protected loadVendors(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const isActive = this.activeFilterControl.value ?? undefined;
    this.vendorService.getVendors(search, isActive).subscribe({
      next: (list) => { this.vendors.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadVendors(); }

  protected selectVendor(item: VendorListItem): void {
    this.vendorService.getVendorById(item.id).subscribe({
      next: (detail) => { this.selectedVendor.set(detail); this.activeTab.set('info'); },
    });
  }

  protected closeDetail(): void { this.selectedVendor.set(null); }

  // --- Vendor CRUD ---
  protected openCreateVendor(): void {
    this.editingVendor.set(null);
    this.showDialog.set(true);
  }

  protected openEditVendor(): void {
    const v = this.selectedVendor();
    if (!v) return;
    this.editingVendor.set(v);
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected onDialogSaved(): void {
    this.closeDialog();
    this.loadVendors();
    const editing = this.editingVendor();
    if (editing) {
      this.vendorService.getVendorById(editing.id).subscribe(d => this.selectedVendor.set(d));
    }
  }

  protected toggleActive(): void {
    const v = this.selectedVendor();
    if (!v) return;
    this.vendorService.updateVendor(v.id, { isActive: !v.isActive }).subscribe({
      next: () => {
        this.vendorService.getVendorById(v.id).subscribe(d => this.selectedVendor.set(d));
        this.loadVendors();
        this.snackbar.success(v.isActive ? 'Vendor deactivated.' : 'Vendor activated.');
      },
    });
  }

  protected deleteVendor(): void {
    const v = this.selectedVendor();
    if (!v) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Vendor?',
        message: `This will remove "${v.companyName}" from the system. This action cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.vendorService.deleteVendor(v.id).subscribe({
        next: () => {
          this.selectedVendor.set(null);
          this.loadVendors();
          this.snackbar.success('Vendor deleted.');
        },
      });
    });
  }

  protected getPoStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Submitted: 'chip--info',
      Acknowledged: 'chip--primary',
      PartiallyReceived: 'chip--warning',
      Received: 'chip--success',
      Closed: 'chip--muted',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getPoStatusLabel(status: string): string {
    return status === 'PartiallyReceived' ? 'Partial' : status;
  }
}
