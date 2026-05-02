import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { PriceListEntry } from '../../models/price-list.model';

/**
 * Pattern B (per `phase-4-output/pricelist-entry-edit-ux.md` §4) — list
 * panel for the rows of a single PriceList. Click a row to open the
 * edit dialog. Mirrors the structure of `<app-vendor-part-list-panel>`
 * because PriceListEntry is structurally identical (child catalog with
 * price + tier + currency + notes).
 */
@Component({
  selector: 'app-price-list-entries-table',
  standalone: true,
  imports: [
    TranslatePipe,
    MatTooltipModule,
    CurrencyDisplayComponent,
    DataTableComponent, ColumnCellDirective,
    EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './price-list-entries-table.component.html',
  styleUrl: './price-list-entries-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListEntriesTableComponent {
  private readonly translate = inject(TranslateService);

  readonly priceListId = input.required<number>();
  readonly entries = input.required<PriceListEntry[]>();
  readonly loading = input(false);

  readonly add = output<void>();
  readonly edit = output<PriceListEntry>();
  readonly delete = output<PriceListEntry>();

  protected readonly columns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '140px' },
    { field: 'partName', header: 'Description', sortable: true },
    { field: 'minQuantity', header: 'Min Qty', sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'unitPrice', header: 'Unit Price', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'currency', header: 'Currency', sortable: true, width: '90px' },
    { field: 'notes', header: 'Notes' },
    { field: 'actions', header: '', width: '80px' },
  ];

  protected onAdd(): void { this.add.emit(); }
  protected onEdit(row: PriceListEntry): void { this.edit.emit(row); }
  protected onDelete(row: PriceListEntry): void { this.delete.emit(row); }

  /** Localised "Add Entry" label, surfaced via getter for template + emptyState. */
  protected addLabel(): string {
    return this.translate.instant('customers.pricing.addEntry');
  }
}
