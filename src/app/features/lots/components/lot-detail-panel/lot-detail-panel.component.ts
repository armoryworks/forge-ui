import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LotService } from '../../services/lot.service';
import { LotTrace, LotTraceEvent } from '../../models/lot-trace.model';
import { RecallDetail } from '../../../quality/models/recall-detail.model';
import {
  InitiateRecallDialogComponent,
  InitiateRecallDialogData,
} from '../../../quality/components/initiate-recall-dialog/initiate-recall-dialog.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';

const STATUS_KEYS: Record<string, Record<string, string>> = {
  QcInspection: {
    InProgress: 'quality.statusInProgress',
    Passed: 'quality.statusPassed',
    Failed: 'quality.statusFailed',
  },
  ProductionRun: {
    Planned: 'status.planned',
    InProgress: 'status.inProgress',
    Completed: 'status.completed',
    Cancelled: 'status.cancelled',
  },
};

const RECEIPT_STATUS_KEYS: Record<string, string> = {
  NotRequired: 'recalls.trace.receiptStatusNotRequired',
  Pending: 'recalls.trace.receiptStatusPending',
  InProgress: 'quality.statusInProgress',
  Passed: 'quality.statusPassed',
  Failed: 'quality.statusFailed',
  Waived: 'recalls.trace.receiptStatusWaived',
  PartialAccept: 'inventory.receivingInspection.results.partialAccept',
};

const NCR_STATUS_KEYS: Record<string, string> = {
  Open: 'status.open',
  UnderReview: 'recalls.trace.ncrStatusUnderReview',
  Contained: 'recalls.trace.ncrStatusContained',
  Dispositioned: 'recalls.trace.ncrStatusDispositioned',
  Closed: 'status.closed',
};

@Component({
  selector: 'app-lot-detail-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatTooltipModule, TranslatePipe, BarcodeInfoComponent, EntityActivitySectionComponent, LoadingBlockDirective, DataTableComponent, ColumnCellDirective, EntityLinkComponent],
  templateUrl: './lot-detail-panel.component.html',
  styleUrl: './lot-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotDetailPanelComponent {
  private readonly service = inject(LotService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly hostDialogRef = inject(MatDialogRef, { optional: true });

  readonly lotId = input.required<number>();
  readonly lotNumber = input.required<string>();
  readonly closed = output<void>();

  protected readonly trace = signal<LotTrace | null>(null);
  protected readonly loading = signal(true);
  protected readonly initiatedRecall = signal<RecallDetail | null>(null);

  protected readonly shippedTo = computed(() => this.trace()?.shippedTo ?? []);
  protected readonly receivedFrom = computed(() => this.trace()?.receivedFrom ?? []);
  protected readonly inspections = computed(() => this.trace()?.inspections ?? []);
  protected readonly nonConformances = computed(() => this.trace()?.nonConformances ?? []);

  protected readonly canInitiateRecall = computed(() =>
    this.auth.hasAnyRole(['Admin', 'Manager']) && this.capabilities.isEnabled('CAP-QC-RECALL'));

  protected readonly shippedToColumns: ColumnDef[] = [
    { field: 'customerName', header: this.translate.instant('lots.colCustomer'), sortable: true },
    { field: 'shipmentNumber', header: this.translate.instant('lots.colShipment'), sortable: true, width: '120px' },
    { field: 'shippedDate', header: this.translate.instant('lots.colShipDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'quantity', header: this.translate.instant('lots.colQty'), sortable: true, type: 'number', width: '80px', align: 'right' },
  ];

  protected readonly receivedFromColumns: ColumnDef[] = [
    { field: 'vendorName', header: this.translate.instant('recalls.trace.colVendor'), sortable: true },
    { field: 'poNumber', header: this.translate.instant('recalls.trace.colPurchaseOrder'), sortable: true, width: '120px' },
    { field: 'receivedAt', header: this.translate.instant('recalls.trace.colReceived'), sortable: true, type: 'date', width: '110px' },
    { field: 'quantity', header: this.translate.instant('lots.colQty'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'inspectionStatus', header: this.translate.instant('recalls.trace.colInspection'), sortable: true, width: '120px' },
  ];

  protected readonly inspectionColumns: ColumnDef[] = [
    { field: 'templateName', header: this.translate.instant('quality.template'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '110px' },
    { field: 'inspectorName', header: this.translate.instant('quality.inspector'), sortable: true, width: '140px' },
    { field: 'results', header: this.translate.instant('recalls.trace.colResults'), width: '100px', align: 'center' },
    { field: 'createdAt', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly ncrColumns: ColumnDef[] = [
    { field: 'ncrNumber', header: this.translate.instant('recalls.trace.colNcr'), sortable: true, width: '130px' },
    { field: 'description', header: this.translate.instant('lots.description'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'affectedQuantity', header: this.translate.instant('lots.colQty'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'detectedAt', header: this.translate.instant('recalls.trace.colDetected'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    effect(() => {
      const num = this.lotNumber();
      if (!num) return;
      this.loading.set(true);
      this.service.trace(num).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (t) => { this.trace.set(t); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    });
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

  protected statusKey(event: LotTraceEvent): string | null {
    if (!event.statusCode) return null;
    return STATUS_KEYS[event.type]?.[event.statusCode] ?? null;
  }

  protected inspectionStatusKey(status: string): string {
    return STATUS_KEYS['QcInspection'][status] ?? status;
  }

  protected receiptStatusKey(status: string): string {
    return RECEIPT_STATUS_KEYS[status] ?? status;
  }

  protected ncrStatusKey(status: string): string {
    return NCR_STATUS_KEYS[status] ?? status;
  }

  protected openInitiateRecall(): void {
    this.dialog.open<InitiateRecallDialogComponent, InitiateRecallDialogData, RecallDetail | undefined>(
      InitiateRecallDialogComponent,
      { width: '480px', data: { lotId: this.lotId(), lotNumber: this.lotNumber() } },
    ).afterClosed().subscribe(recall => {
      if (recall) this.initiatedRecall.set(recall);
    });
  }

  protected openRecall(recallId: number): void {
    const navigate = () => this.router.navigate(['/quality/recalls'], { queryParams: { detail: `recall:${recallId}` } });
    if (this.hostDialogRef) {
      this.hostDialogRef.afterClosed().subscribe(() => navigate());
      this.closed.emit();
    } else {
      navigate();
    }
  }
}
