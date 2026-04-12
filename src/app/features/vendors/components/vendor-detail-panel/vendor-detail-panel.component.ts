import {
  ChangeDetectionStrategy, Component, computed, effect, inject,
  input, output, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorService } from '../../services/vendor.service';
import { VendorDetail } from '../../models/vendor-detail.model';
import { VendorDialogComponent } from '../vendor-dialog/vendor-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { VendorScorecardTabComponent } from '../vendor-scorecard-tab/vendor-scorecard-tab.component';

@Component({
  selector: 'app-vendor-detail-panel',
  standalone: true,
  imports: [
    DatePipe,
    MatTooltipModule,
    TranslatePipe,
    DataTableComponent, ColumnCellDirective,
    EmptyStateComponent, LoadingBlockDirective,
    VendorDialogComponent, EntityActivitySectionComponent, VendorScorecardTabComponent,
  ],
  templateUrl: './vendor-detail-panel.component.html',
  styleUrl: './vendor-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDetailPanelComponent {
  private readonly vendorService = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly vendorId = input.required<number>();
  readonly closed = output<void>();
  readonly vendorChanged = output<void>();

  protected readonly loading = signal(false);
  protected readonly vendor = signal<VendorDetail | null>(null);
  protected readonly activeTab = signal<'info' | 'purchase-orders' | 'scorecard'>('info');

  // Inline edit dialog
  protected readonly showEditDialog = signal(false);

  protected readonly vendorName = computed(() => this.vendor()?.companyName ?? '');

  protected readonly poColumns: ColumnDef[] = [
    { field: 'poNumber', header: this.translate.instant('vendors.poNumber'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '140px' },
    { field: 'lineCount', header: this.translate.instant('vendors.lines'), sortable: true, width: '70px', align: 'center' },
    { field: 'expectedDeliveryDate', header: this.translate.instant('vendors.expected'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    effect(() => {
      const id = this.vendorId();
      if (id) {
        this.loadVendor(id);
      }
    });
  }

  private loadVendor(id: number): void {
    this.loading.set(true);
    this.vendorService.getVendorById(id).subscribe({
      next: (detail) => {
        this.vendor.set(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openEditVendor(): void {
    this.showEditDialog.set(true);
  }

  protected closeEditDialog(): void {
    this.showEditDialog.set(false);
  }

  protected onEditSaved(): void {
    this.showEditDialog.set(false);
    this.loadVendor(this.vendorId());
    this.vendorChanged.emit();
  }

  protected toggleActive(): void {
    const v = this.vendor();
    if (!v) return;
    this.vendorService.updateVendor(v.id, { isActive: !v.isActive }).subscribe({
      next: () => {
        this.loadVendor(v.id);
        this.vendorChanged.emit();
        this.snackbar.success(this.translate.instant(v.isActive ? 'vendors.vendorDeactivated' : 'vendors.vendorActivated'));
      },
    });
  }

  protected deleteVendor(): void {
    const v = this.vendor();
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
          this.vendorChanged.emit();
          this.closed.emit();
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
