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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    VendorDialogComponent, EmptyStateComponent, LoadingBlockDirective,
    TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsComponent {
  private readonly vendorService = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

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
    { value: null, label: this.translate.instant('vendors.allFilter') },
    { value: true, label: this.translate.instant('vendors.activeFilter') },
    { value: false, label: this.translate.instant('vendors.inactiveFilter') },
  ];

  protected readonly vendorColumns: ColumnDef[] = [
    { field: 'companyName', header: this.translate.instant('vendors.companyName'), sortable: true },
    { field: 'contactName', header: this.translate.instant('vendors.contact'), sortable: true },
    { field: 'email', header: this.translate.instant('common.email'), sortable: true },
    { field: 'phone', header: this.translate.instant('common.phone'), sortable: true },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, type: 'enum', filterable: true, filterOptions: [
      { value: true, label: this.translate.instant('common.active') }, { value: false, label: this.translate.instant('common.inactive') },
    ], width: '80px' },
    { field: 'poCount', header: this.translate.instant('vendors.pos'), sortable: true, width: '70px', align: 'center' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly vendorRowClass = (row: unknown) => {
    const v = row as VendorListItem;
    return v.id === this.selectedVendor()?.id ? 'row--selected' : '';
  };

  protected readonly poColumns: ColumnDef[] = [
    { field: 'poNumber', header: this.translate.instant('vendors.poNumber'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '140px' },
    { field: 'lineCount', header: this.translate.instant('vendors.lines'), sortable: true, width: '70px', align: 'center' },
    { field: 'expectedDeliveryDate', header: this.translate.instant('vendors.expected'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
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
        this.snackbar.success(this.translate.instant(v.isActive ? 'vendors.vendorDeactivated' : 'vendors.vendorActivated'));
      },
    });
  }

  protected deleteVendor(): void {
    const v = this.selectedVendor();
    if (!v) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('vendors.deleteVendorTitle'),
        message: this.translate.instant('vendors.deleteVendorMessage', { name: v.companyName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.vendorService.deleteVendor(v.id).subscribe({
        next: () => {
          this.selectedVendor.set(null);
          this.loadVendors();
          this.snackbar.success(this.translate.instant('vendors.vendorDeleted'));
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
    return status === 'PartiallyReceived' ? this.translate.instant('vendors.poStatusPartial') : status;
  }
}
