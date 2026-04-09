import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';

import { LotService } from './services/lot.service';
import { LotListItem } from './models/lot-list-item.model';
import { LotDialogComponent } from './components/lot-dialog/lot-dialog.component';
import { LotDetailDialogComponent, LotDetailDialogData } from './components/lot-detail-dialog/lot-detail-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { openDetailDialog } from '../../shared/utils/detail-dialog.utils';

@Component({
  selector: 'app-lots',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent, InputComponent,
    DataTableComponent, ColumnCellDirective,
    LotDialogComponent, LoadingBlockDirective, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './lots.component.html',
  styleUrl: './lots.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotsComponent {
  private readonly service = inject(LotService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(false);
  protected readonly lots = signal<LotListItem[]>([]);

  protected readonly showCreateDialog = signal(false);

  protected readonly searchControl = new FormControl('');

  protected readonly columns: ColumnDef[] = [
    { field: 'lotNumber', header: this.translate.instant('lots.lotNumber'), sortable: true, width: '180px' },
    { field: 'partNumber', header: this.translate.instant('lots.partNumber'), sortable: true, width: '120px' },
    { field: 'partDescription', header: this.translate.instant('lots.description'), sortable: true },
    { field: 'quantity', header: this.translate.instant('lots.quantity'), sortable: true, width: '90px', align: 'right' },
    { field: 'jobNumber', header: this.translate.instant('lots.job'), sortable: true, width: '120px' },
    { field: 'supplierLotNumber', header: this.translate.instant('lots.supplierLot'), sortable: true, width: '140px' },
    { field: 'expirationDate', header: this.translate.instant('lots.expires'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const search = this.searchControl.value?.trim() || undefined;
    this.service.getLots(search).subscribe({
      next: (list) => { this.lots.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applySearch(): void { this.load(); }

  protected openLotDetail(row: unknown): void {
    const item = row as LotListItem;
    openDetailDialog<LotDetailDialogComponent, LotDetailDialogData>(
      this.dialog,
      LotDetailDialogComponent,
      { lotId: item.id, lotNumber: item.lotNumber },
    );
  }

  protected openCreate(): void { this.showCreateDialog.set(true); }
  protected closeCreate(): void { this.showCreateDialog.set(false); }

  protected onCreated(): void {
    this.closeCreate();
    this.load();
  }
}
