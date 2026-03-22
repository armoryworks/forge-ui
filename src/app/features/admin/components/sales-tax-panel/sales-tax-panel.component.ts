import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { SalesTaxRate } from '../../models/sales-tax-rate.model';

type SalesTaxRateRow = SalesTaxRate & { rateDisplay: string };
import { SalesTaxDialogComponent } from '../sales-tax-dialog/sales-tax-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-sales-tax-panel',
  standalone: true,
  imports: [
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    SalesTaxDialogComponent, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './sales-tax-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTaxPanelComponent {
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly rates = signal<SalesTaxRateRow[]>([]);

  protected readonly showDialog = signal(false);
  protected readonly editingRate = signal<SalesTaxRate | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'code', header: 'Code', sortable: true, width: '120px' },
    { field: 'rateDisplay', header: 'Rate', sortable: true, width: '90px', align: 'right' },
    { field: 'isDefault', header: 'Default', width: '80px', align: 'center' },
    { field: 'isActive', header: 'Active', width: '80px', align: 'center' },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.adminService.getSalesTaxRates().subscribe({
      next: (list) => {
        this.rates.set(list.map(r => ({ ...r, rateDisplay: `${(r.rate * 100).toFixed(3).replace(/\.?0+$/, '')}%` })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.editingRate.set(null);
    this.showDialog.set(true);
  }

  protected openEdit(rate: SalesTaxRate): void {
    this.editingRate.set(rate);
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected onSaved(): void {
    this.closeDialog();
    this.load();
  }

  protected deleteRate(rate: SalesTaxRate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesTax.deleteTitle'),
        message: this.translate.instant('salesTax.deleteMessage', { name: rate.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.deleteSalesTaxRate(rate.id).subscribe({
        next: () => {
          this.load();
          this.snackbar.success(this.translate.instant('salesTax.deleted'));
        },
        error: () => this.snackbar.error(this.translate.instant('salesTax.deleteFailed')),
      });
    });
  }
}
