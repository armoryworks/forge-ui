import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { PercentPipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { SalesTaxRate } from '../../models/sales-tax-rate.model';
import { SalesTaxDialogComponent } from '../sales-tax-dialog/sales-tax-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';

@Component({
  selector: 'app-sales-tax-panel',
  standalone: true,
  imports: [
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    SalesTaxDialogComponent, TranslatePipe, MatTooltipModule, PercentPipe,
  ],
  templateUrl: './sales-tax-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTaxPanelComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly draftResume = inject(DraftResumeService);

  protected readonly loading = signal(false);
  protected readonly rates = signal<SalesTaxRate[]>([]);

  protected readonly showDialog = signal(false);
  protected readonly editingRate = signal<SalesTaxRate | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('salesTax.fieldName'), sortable: true },
    { field: 'code', header: this.translate.instant('salesTax.fieldCode'), sortable: true, width: '120px' },
    { field: 'rate', header: this.translate.instant('salesTax.colRate'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'isDefault', header: this.translate.instant('salesTax.default'), width: '80px', align: 'center' },
    { field: 'isActive', header: this.translate.instant('common.active'), width: '80px', align: 'center' },
    { field: 'actions', header: '', width: '120px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  ngOnInit(): void {
    if (this.draftResume.consume('sales-tax-rate')) {
      this.openCreate();
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.adminService.getSalesTaxRates().subscribe({
      next: (list) => {
        this.rates.set(list);
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
        error: (err: unknown) => this.snackbar.errorFrom(err, 'salesTax.deleteFailed'),
      });
    });
  }
}
