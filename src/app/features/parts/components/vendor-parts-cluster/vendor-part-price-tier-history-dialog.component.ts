import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';

import { VendorPart, VendorPartPriceTier } from '../../models/vendor-part.model';
import { VendorPartsService } from '../../services/vendor-parts.service';

export interface VendorPartPriceTierHistoryDialogData {
  vendorPart: VendorPart;
}

/**
 * Dispatch C — Read-only history of every VendorPartPriceTier row for a
 * VendorPart (current + closed), sorted EffectiveFrom DESC then MinQuantity
 * ASC. Opened from the "history" affordance on the Vendor catalog row.
 *
 * Distinct from {@link VendorPartPriceTiersDialogComponent}, which manages
 * the CURRENT tier set (add / remove). This dialog never edits — it only
 * shows what was billed/quoted before.
 */
@Component({
  selector: 'app-vendor-part-price-tier-history-dialog',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe,
    MatTooltipModule,
    DialogComponent,
    CurrencyDisplayComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    EmptyStateComponent,
  ],
  templateUrl: './vendor-part-price-tier-history-dialog.component.html',
  styleUrl: './vendor-part-price-tier-history-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPartPriceTierHistoryDialogComponent implements OnInit {
  private readonly vendorPartsService = inject(VendorPartsService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<VendorPartPriceTierHistoryDialogComponent>);
  protected readonly data = inject<VendorPartPriceTierHistoryDialogData>(MAT_DIALOG_DATA);

  protected readonly tiers = signal<VendorPartPriceTier[]>([]);
  protected readonly loading = signal(false);

  protected readonly title = computed(() =>
    `${this.data.vendorPart.partNumber} — ${this.data.vendorPart.vendorCompanyName}`,
  );

  protected readonly columns: ColumnDef[] = [
    { field: 'minQuantity', header: this.translate.instant('vendorPart.priceTiers.minQuantity'), sortable: true, width: '90px', align: 'right' },
    { field: 'unitPrice', header: this.translate.instant('vendorPart.priceTiers.unitPrice'), sortable: true, width: '130px', align: 'right' },
    { field: 'effectiveFrom', header: this.translate.instant('vendorPart.priceTiers.effectiveFrom'), sortable: true, width: '110px' },
    { field: 'effectiveTo', header: this.translate.instant('vendorPart.priceTiers.effectiveTo'), sortable: true, width: '110px' },
    { field: 'notes', header: this.translate.instant('vendorPart.notes') },
  ];

  ngOnInit(): void {
    this.loadHistory();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.vendorPartsService.getPriceTierHistory(this.data.vendorPart.id).subscribe({
      next: (rows) => {
        this.tiers.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
