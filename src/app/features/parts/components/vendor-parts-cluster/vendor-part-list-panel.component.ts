import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { VendorPart } from '../../models/vendor-part.model';

export type VendorPartListMode = 'sources' | 'catalog';
export type VendorPartParentEntityType = 'part' | 'vendor';

/**
 * Reusable list panel for VendorPart rows. Renders a configurable
 * data-table that switches column set + empty-state copy based on
 * `mode`:
 *   - `sources`: used on Part detail (rows = vendors that supply this part)
 *   - `catalog`: used on Vendor detail (rows = parts this vendor supplies)
 *
 * Pillar 4 prep — the parent owns the data and event handlers; this
 * component is purely presentational and emits intent.
 */
@Component({
  selector: 'app-vendor-part-list-panel',
  standalone: true,
  imports: [
    TranslatePipe,
    MatTooltipModule,
    CurrencyDisplayComponent,
    DataTableComponent, ColumnCellDirective,
    EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './vendor-part-list-panel.component.html',
  styleUrl: './vendor-part-list-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPartListPanelComponent {
  private readonly translate = inject(TranslateService);

  readonly mode = input.required<VendorPartListMode>();
  readonly parentEntityType = input.required<VendorPartParentEntityType>();
  readonly parentEntityId = input.required<number>();
  readonly vendorParts = input.required<VendorPart[]>();
  readonly loading = input(false);

  readonly add = output<void>();
  readonly edit = output<VendorPart>();
  readonly delete = output<VendorPart>();
  readonly togglePreferred = output<VendorPart>();
  readonly viewTiers = output<VendorPart>();

  protected readonly tableId = computed(() =>
    this.mode() === 'sources' ? 'part-vendor-sources' : 'vendor-part-catalog',
  );

  protected readonly emptyIcon = computed(() =>
    this.mode() === 'sources' ? 'store' : 'category',
  );

  protected readonly emptyMessageKey = computed(() =>
    this.mode() === 'sources' ? 'parts.detail.sourcesEmpty' : 'vendors.detail.catalogEmpty',
  );

  protected readonly emptyHelpKey = computed(() =>
    this.mode() === 'sources' ? 'parts.detail.sourcesEmptyHelp' : 'vendors.detail.catalogEmptyHelp',
  );

  protected readonly addLabelKey = computed(() =>
    this.mode() === 'sources' ? 'parts.detail.addVendorSource' : 'vendors.detail.addPartToCatalog',
  );

  protected readonly columns = computed<ColumnDef[]>(() => {
    const t = this.translate;
    if (this.mode() === 'sources') {
      return [
        { field: 'isPreferred', header: '', width: '36px', align: 'center', sortable: true },
        { field: 'vendorCompanyName', header: t.instant('vendors.companyName'), sortable: true },
        { field: 'vendorPartNumber', header: t.instant('vendorPart.vendorPartNumber'), sortable: true, width: '120px' },
        { field: 'vendorMpn', header: t.instant('vendorPart.vendorMpn'), sortable: true, width: '120px' },
        { field: 'leadTimeDays', header: t.instant('vendorPart.leadTimeDays'), sortable: true, width: '90px', align: 'center' },
        { field: 'minOrderQty', header: t.instant('vendorPart.minOrderQty'), sortable: true, width: '80px', align: 'center' },
        { field: 'packSize', header: t.instant('vendorPart.packSize'), sortable: true, width: '70px', align: 'center' },
        { field: 'lowestTierPrice', header: t.instant('vendorPart.priceTiersLabel'), width: '110px', align: 'right' },
        { field: 'isApproved', header: t.instant('vendorPart.isApproved'), width: '90px', align: 'center', sortable: true },
        { field: 'notes', header: t.instant('vendorPart.notes') },
        { field: 'actions', header: '', width: '80px' },
      ];
    }
    return [
      { field: 'partNumber', header: t.instant('parts.partNumber'), sortable: true, width: '130px' },
      { field: 'partName', header: t.instant('common.name'), sortable: true },
      { field: 'vendorPartNumber', header: t.instant('vendorPart.vendorPartNumber'), sortable: true, width: '120px' },
      { field: 'vendorMpn', header: t.instant('vendorPart.vendorMpn'), sortable: true, width: '120px' },
      { field: 'leadTimeDays', header: t.instant('vendorPart.leadTimeDays'), sortable: true, width: '90px', align: 'center' },
      { field: 'minOrderQty', header: t.instant('vendorPart.minOrderQty'), sortable: true, width: '80px', align: 'center' },
      { field: 'packSize', header: t.instant('vendorPart.packSize'), sortable: true, width: '70px', align: 'center' },
      { field: 'lowestTierPrice', header: t.instant('vendorPart.priceTiersLabel'), width: '110px', align: 'right' },
      { field: 'isApproved', header: t.instant('vendorPart.isApproved'), width: '90px', align: 'center', sortable: true },
      { field: 'isPreferred', header: t.instant('vendorPart.isPreferred'), width: '90px', align: 'center', sortable: true },
      { field: 'notes', header: t.instant('vendorPart.notes') },
      { field: 'actions', header: '', width: '80px' },
    ];
  });

  /** Lowest unit price across active tiers, with currency. Null if no tiers. */
  getLowestTier(row: VendorPart): { price: number; currency: string } | null {
    if (!row.priceTiers || row.priceTiers.length === 0) return null;
    const sorted = [...row.priceTiers].sort((a, b) => a.unitPrice - b.unitPrice);
    const lowest = sorted[0];
    return { price: lowest.unitPrice, currency: lowest.currency };
  }

  protected onAdd(): void { this.add.emit(); }
  protected onEdit(row: VendorPart): void { this.edit.emit(row); }
  protected onDelete(row: VendorPart): void { this.delete.emit(row); }
  protected onTogglePreferred(row: VendorPart): void { this.togglePreferred.emit(row); }
  protected onViewTiers(row: VendorPart): void { this.viewTiers.emit(row); }
}
