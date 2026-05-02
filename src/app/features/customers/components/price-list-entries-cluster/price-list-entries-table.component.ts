import {
  AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, inject, input, output,
  signal, ViewChild,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { PriceListEntry } from '../../models/price-list.model';
import { PriceListsService } from '../../services/price-lists.service';

/** Fields that opt in to the inline-cell edit affordance. */
type EditableField = 'unitPrice' | 'minQuantity';

/**
 * Pattern D (per `phase-4-output/pricelist-entry-edit-ux.md` §4) — list panel
 * for the rows of a single PriceList. The full-row edit dialog is still
 * available via the row Edit button; the high-volume cells (unitPrice,
 * minQuantity) additionally support click-to-edit inline editing for
 * faster bulk price tweaks.
 *
 * Inline-edit lifecycle (per-cell, pessimistic):
 *   click  → flip cell to <input>, focus the input, select text
 *   Enter  → validate → PUT → on success flip back, on error keep open + tooltip
 *   blur   → same as Enter
 *   Escape → revert to read state, no save
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
export class PriceListEntriesTableComponent implements AfterViewChecked {
  private readonly translate = inject(TranslateService);
  private readonly priceListsService = inject(PriceListsService);

  readonly priceListId = input.required<number>();
  readonly entries = input.required<PriceListEntry[]>();
  readonly loading = input(false);

  readonly add = output<void>();
  readonly edit = output<PriceListEntry>();
  readonly delete = output<PriceListEntry>();
  /**
   * Emitted after a successful inline-cell save. The parent should splice
   * the updated entry into its list cache (no need to refetch the whole
   * page).
   */
  readonly cellSaved = output<PriceListEntry>();

  /** The cell currently in edit mode, or null. */
  protected readonly editingCell = signal<{ entryId: number; field: EditableField } | null>(null);
  /** The cell currently being saved (PUT in flight). */
  protected readonly cellSaving = signal<{ entryId: number; field: EditableField } | null>(null);
  /** A failed-save banner pinned to a specific cell, with the server message. */
  protected readonly cellError = signal<{ entryId: number; field: EditableField; message: string } | null>(null);

  @ViewChild('cellEditInput') private cellEditInput?: ElementRef<HTMLInputElement>;
  /** Tracks whether we have already focused the most-recent inline input. */
  private lastFocusedKey: string | null = null;

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

  // -------- Inline-edit lifecycle --------

  protected isEditing(entry: PriceListEntry, field: EditableField): boolean {
    const c = this.editingCell();
    return c?.entryId === entry.id && c?.field === field;
  }

  protected isSaving(entry: PriceListEntry, field: EditableField): boolean {
    const c = this.cellSaving();
    return c?.entryId === entry.id && c?.field === field;
  }

  protected getCellError(entry: PriceListEntry, field: EditableField): string | null {
    const c = this.cellError();
    return c?.entryId === entry.id && c?.field === field ? c.message : null;
  }

  protected startEdit(entry: PriceListEntry, field: EditableField): void {
    // If there's a different cell open and dirty, blur-save handled it; we
    // can safely flip into the new cell.
    this.editingCell.set({ entryId: entry.id, field });
    this.cellError.set(null);
  }

  protected commitEdit(entry: PriceListEntry, field: EditableField, rawValue: number): void {
    // Treat NaN / empty as a cancel — don't blast the server with garbage.
    if (Number.isNaN(rawValue)) {
      this.cancelEdit();
      return;
    }
    const newValue = field === 'minQuantity' ? Math.trunc(rawValue) : rawValue;

    if (newValue === entry[field]) {
      this.editingCell.set(null);
      this.cellError.set(null);
      return;
    }

    // Local guards — match the server's FluentValidation rules so we surface
    // problems instantly without a round trip.
    if (newValue < 0 || (field === 'minQuantity' && newValue < 1)) {
      this.cellError.set({
        entryId: entry.id,
        field,
        message: this.translate.instant('priceListEntry.cellEditInvalid'),
      });
      return;
    }

    this.cellSaving.set({ entryId: entry.id, field });
    this.priceListsService.updateEntry(entry.id, {
      unitPrice: field === 'unitPrice' ? newValue : entry.unitPrice,
      minQuantity: field === 'minQuantity' ? newValue : entry.minQuantity,
      currency: entry.currency,
      notes: entry.notes,
    }).subscribe({
      next: (updated) => {
        this.cellSaving.set(null);
        this.editingCell.set(null);
        this.cellError.set(null);
        this.cellSaved.emit(updated);
      },
      error: (err: { error?: { title?: string; detail?: string } }) => {
        this.cellSaving.set(null);
        const msg = err?.error?.detail
          ?? err?.error?.title
          ?? this.translate.instant('priceListEntry.cellEditError');
        this.cellError.set({ entryId: entry.id, field, message: msg });
      },
    });
  }

  protected cancelEdit(): void {
    this.editingCell.set(null);
    this.cellError.set(null);
    this.cellSaving.set(null);
  }

  /**
   * Reads the input's value (handles empty as NaN) — pulled out of the
   * template to keep the template lean.
   */
  protected readValue(target: EventTarget | null): number {
    const el = target as HTMLInputElement | null;
    if (!el) return NaN;
    const v = el.value;
    if (v === '' || v == null) return NaN;
    return Number(v);
  }

  /**
   * Autofocus the inline input after Angular renders it. Plain `autofocus`
   * is unreliable when Angular swaps the @if branch; this sidesteps that.
   */
  ngAfterViewChecked(): void {
    const c = this.editingCell();
    const input = this.cellEditInput?.nativeElement;
    if (!c || !input) {
      this.lastFocusedKey = null;
      return;
    }
    const key = `${c.entryId}:${c.field}`;
    if (this.lastFocusedKey === key) return;
    this.lastFocusedKey = key;
    // Defer to next microtask so the value bind has applied.
    queueMicrotask(() => {
      input.focus();
      input.select();
    });
  }
}
