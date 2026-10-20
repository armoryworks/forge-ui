import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { RecallService } from '../../services/recall.service';
import { Recall } from '../../models/recall.model';
import { RECALL_STATUS_CHIP_CLASSES, RECALL_STATUS_LABEL_KEYS, RecallStatus } from '../../models/recall-status.model';
import { RecallDetailDialogComponent, RecallDetailDialogData } from '../recall-detail-dialog/recall-detail-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DetailDialogService } from '../../../../shared/services/detail-dialog.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { RecallDetail } from '../../models/recall-detail.model';
import { QUALITY_MANAGER_ROLES } from '../../quality-roles';
import { InitiateRecallDialogComponent, InitiateRecallDialogData } from '../initiate-recall-dialog/initiate-recall-dialog.component';

const RECALL_ENTITY_TYPE = 'recall';

@Component({
  selector: 'app-recall-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TranslatePipe,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './recall-list.component.html',
  styleUrl: './recall-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecallListComponent {
  private readonly recallService = inject(RecallService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  protected readonly canStartRecall = this.auth.hasAnyRole(QUALITY_MANAGER_ROLES);

  protected readonly loading = signal(false);
  protected readonly recalls = signal<Recall[]>([]);
  private readonly openedRecallId = signal<number | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'id', header: this.translate.instant('recalls.colNumber'), sortable: true, width: '110px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: (Object.keys(RECALL_STATUS_LABEL_KEYS) as RecallStatus[]).map(s => ({
        value: s, label: this.translate.instant(RECALL_STATUS_LABEL_KEYS[s]),
      })) },
    { field: 'initiatedLotNumber', header: this.translate.instant('recalls.colLot'), sortable: true, width: '160px' },
    { field: 'reason', header: this.translate.instant('recalls.reason'), sortable: true },
    { field: 'affectedLotsCount', header: this.translate.instant('recalls.colLots'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'totalQuarantinedQuantity', header: this.translate.instant('recalls.colQuarantined'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'affectedShipmentsCount', header: this.translate.instant('recalls.colShipments'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'affectedCustomersCount', header: this.translate.instant('recalls.colCustomers'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'recallDate', header: this.translate.instant('recalls.recallDate'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.load();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      const detail = this.detailDialog.getDetailFromUrl();
      if (detail?.entityType === RECALL_ENTITY_TYPE) {
        if (this.openedRecallId() !== detail.entityId) this.openRecall(detail.entityId);
      } else {
        this.openedRecallId.set(null);
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.recallService.getRecalls().subscribe({
      next: (recalls) => { this.recalls.set(recalls); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected startRecall(): void {
    this.dialog.open<InitiateRecallDialogComponent, InitiateRecallDialogData, RecallDetail | undefined>(
      InitiateRecallDialogComponent,
      { width: '480px', data: { lotId: null, lotNumber: null } },
    ).afterClosed().subscribe(recall => {
      if (!recall) return;
      this.load();
      this.openRecall(recall.id);
    });
  }

  protected onRowClick(row: unknown): void {
    this.openRecall((row as Recall).id);
  }

  protected statusLabelKey(status: RecallStatus): string {
    return RECALL_STATUS_LABEL_KEYS[status] ?? status;
  }

  protected statusChipClass(status: RecallStatus): string {
    return RECALL_STATUS_CHIP_CLASSES[status] ?? 'chip--muted';
  }

  private openRecall(recallId: number): void {
    this.openedRecallId.set(recallId);
    this.detailDialog.open<RecallDetailDialogComponent, RecallDetailDialogData, boolean>(
      RECALL_ENTITY_TYPE,
      recallId,
      RecallDetailDialogComponent,
      { recallId },
    ).afterClosed().subscribe(() => {
      this.openedRecallId.set(null);
      this.load();
    });
  }
}
