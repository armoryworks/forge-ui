import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorService } from './services/vendor.service';
import { VendorListItem } from './models/vendor-list-item.model';
import { VendorDialogComponent } from './components/vendor-dialog/vendor-dialog.component';
import { VendorDetailDialogComponent, VendorDetailDialogData } from './components/vendor-detail-dialog/vendor-detail-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { openDetailDialog } from '../../shared/utils/detail-dialog.utils';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    VendorDialogComponent, LoadingBlockDirective,
    TranslatePipe,
  ],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsComponent {
  private readonly vendorService = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly vendors = signal<VendorListItem[]>([]);

  // Create dialog
  protected readonly showDialog = signal(false);

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

  protected openVendorDetail(item: VendorListItem): void {
    openDetailDialog<VendorDetailDialogComponent, VendorDetailDialogData, boolean>(
      this.dialog,
      VendorDetailDialogComponent,
      { vendorId: item.id },
    ).afterClosed().subscribe(changed => {
      if (changed) {
        this.loadVendors();
      }
    });
  }

  protected openCreateVendor(): void {
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected onDialogSaved(): void {
    this.closeDialog();
    this.loadVendors();
  }
}
