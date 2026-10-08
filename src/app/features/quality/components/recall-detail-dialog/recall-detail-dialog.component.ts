import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { RecallService } from '../../services/recall.service';
import { RecallDetail } from '../../models/recall-detail.model';
import { RECALL_STATUS_CHIP_CLASSES, RECALL_STATUS_LABEL_KEYS, RecallStatus } from '../../models/recall-status.model';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

export interface RecallDetailDialogData {
  recallId: number;
}

@Component({
  selector: 'app-recall-detail-dialog',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, ReactiveFormsModule, MatTooltipModule, TranslatePipe,
    TextareaComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './recall-detail-dialog.component.html',
  styleUrl: './recall-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecallDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RecallDetailDialogComponent, boolean>);
  private readonly recallService = inject(RecallService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<RecallDetailDialogData>(MAT_DIALOG_DATA);

  protected readonly recall = signal<RecallDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly resolving = signal(false);
  private changed = false;

  protected readonly affectedCustomerCount = computed(() =>
    new Set((this.recall()?.affectedShipments ?? []).map(s => s.customerId)).size);
  protected readonly approximateCount = computed(() =>
    (this.recall()?.affectedShipments ?? []).filter(s => s.isApproximate).length);
  protected readonly canResolve = computed(() =>
    this.recall()?.status === 'Active' && this.auth.hasAnyRole(['Admin', 'Manager']));

  protected readonly resolveForm = new FormGroup({
    resolutionNotes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly lotColumns: ColumnDef[] = [
    { field: 'lotNumber', header: this.translate.instant('recalls.colLot'), sortable: true },
    { field: 'partNumber', header: this.translate.instant('lots.partNumber'), sortable: true },
    { field: 'onHandQuantity', header: this.translate.instant('recalls.colOnHand'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'quarantinedQuantity', header: this.translate.instant('recalls.colQuarantined'), sortable: true, type: 'number', width: '120px', align: 'right' },
  ];

  protected readonly shipmentColumns: ColumnDef[] = [
    { field: 'customerName', header: this.translate.instant('lots.colCustomer'), sortable: true },
    { field: 'shipmentNumber', header: this.translate.instant('lots.colShipment'), sortable: true, width: '200px' },
    { field: 'shippedDate', header: this.translate.instant('lots.colShipDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'affectedQuantity', header: this.translate.instant('lots.colQty'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'trackingNumber', header: this.translate.instant('recalls.colTracking'), sortable: true, width: '160px' },
  ];

  constructor() {
    this.recallService.getRecall(this.data.recallId).subscribe({
      next: (recall) => { this.recall.set(recall); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected statusLabelKey(status: RecallStatus): string {
    return RECALL_STATUS_LABEL_KEYS[status] ?? status;
  }

  protected statusChipClass(status: RecallStatus): string {
    return RECALL_STATUS_CHIP_CLASSES[status] ?? 'chip--muted';
  }

  protected resolve(): void {
    const recall = this.recall();
    if (!recall || !this.canResolve() || this.resolveForm.invalid || this.resolving()) return;
    this.resolving.set(true);
    const notes = this.resolveForm.controls.resolutionNotes.value.trim();
    this.recallService.resolveRecall(recall.id, notes || null).subscribe({
      next: (updated) => {
        this.resolving.set(false);
        this.recall.set(updated);
        this.changed = true;
        this.resolveForm.reset();
        this.snackbar.success(this.translate.instant('recalls.resolved'));
      },
      error: (err: unknown) => {
        this.resolving.set(false);
        this.snackbar.errorFrom(err, 'recalls.resolveFailed');
      },
    });
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
