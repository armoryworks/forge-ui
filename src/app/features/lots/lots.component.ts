import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LotService } from './services/lot.service';
import { LotListItem } from './models/lot-list-item.model';
import { LotTrace } from './models/lot-trace.model';
import { LotDialogComponent } from './components/lot-dialog/lot-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { DetailSidePanelComponent } from '../../shared/components/detail-side-panel/detail-side-panel.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../shared/services/snackbar.service';

@Component({
  selector: 'app-lots',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent,
    DataTableComponent, ColumnCellDirective, DetailSidePanelComponent,
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

  protected readonly loading = signal(false);
  protected readonly traceLoading = signal(false);
  protected readonly lots = signal<LotListItem[]>([]);
  protected readonly trace = signal<LotTrace | null>(null);
  protected readonly selectedLot = signal<LotListItem | null>(null);

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

  protected readonly rowClass = (row: unknown) => {
    const l = row as LotListItem;
    return l.lotNumber === this.selectedLot()?.lotNumber ? 'row--selected' : '';
  };

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

  protected selectLot(row: unknown): void {
    const item = row as LotListItem;
    this.selectedLot.set(item);
    this.trace.set(null);
    this.traceLoading.set(true);
    this.service.trace(item.lotNumber).subscribe({
      next: (t) => { this.trace.set(t); this.traceLoading.set(false); },
      error: () => this.traceLoading.set(false),
    });
  }

  protected closeDetail(): void {
    this.selectedLot.set(null);
    this.trace.set(null);
  }

  protected openCreate(): void { this.showCreateDialog.set(true); }
  protected closeCreate(): void { this.showCreateDialog.set(false); }

  protected onCreated(): void {
    this.closeCreate();
    this.load();
  }

  protected getTraceEventIcon(type: string): string {
    const map: Record<string, string> = {
      Job: 'work',
      ProductionRun: 'precision_manufacturing',
      PurchaseOrder: 'description',
      BinLocation: 'inventory_2',
      QcInspection: 'fact_check',
    };
    return map[type] ?? 'circle';
  }
}
