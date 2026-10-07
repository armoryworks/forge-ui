import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LotService } from '../../services/lot.service';
import { LotTrace, LotTraceEvent } from '../../models/lot-trace.model';
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

@Component({
  selector: 'app-lot-detail-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatTooltipModule, TranslatePipe, BarcodeInfoComponent, EntityActivitySectionComponent, LoadingBlockDirective, DataTableComponent, ColumnCellDirective],
  templateUrl: './lot-detail-panel.component.html',
  styleUrl: './lot-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotDetailPanelComponent {
  private readonly service = inject(LotService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly lotId = input.required<number>();
  readonly lotNumber = input.required<string>();
  readonly closed = output<void>();

  protected readonly trace = signal<LotTrace | null>(null);
  protected readonly loading = signal(true);

  protected readonly shippedToColumns: ColumnDef[] = [
    { field: 'customerName', header: this.translate.instant('lots.colCustomer'), sortable: true },
    { field: 'shipmentNumber', header: this.translate.instant('lots.colShipment'), sortable: true, width: '120px' },
    { field: 'shippedDate', header: this.translate.instant('lots.colShipDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'quantity', header: this.translate.instant('lots.colQty'), sortable: true, type: 'number', width: '80px', align: 'right' },
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
}
