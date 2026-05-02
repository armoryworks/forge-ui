import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

import { PriceListEntriesTableComponent } from '../../../components/price-list-entries-cluster/price-list-entries-table.component';
import {
  PriceListEntryBulkImportDialogComponent,
  PriceListEntryBulkImportDialogData,
} from '../../../components/price-list-entries-cluster/price-list-entry-bulk-import-dialog/price-list-entry-bulk-import-dialog.component';
import {
  PriceListEntryFormDialogComponent,
  PriceListEntryFormDialogData,
} from '../../../components/price-list-entries-cluster/price-list-entry-form-dialog.component';
import {
  PriceListFormDialogComponent,
  PriceListFormDialogData,
} from '../../../components/price-list-entries-cluster/price-list-form-dialog/price-list-form-dialog.component';
import { PriceList, PriceListEntry } from '../../../models/price-list.model';
import { PriceListsService } from '../../../services/price-lists.service';

/**
 * Pillar 5 — Customer detail Pricing tab. Pattern B (per
 * `phase-4-output/pricelist-entry-edit-ux.md`): list-of-lists selector +
 * `<app-price-list-entries-table>` + `<app-price-list-entry-form-dialog>`.
 *
 * This dispatch (PriceList CRUD UI) wires the parent CRUD dialog
 * (`PriceListFormDialogComponent`) into the New / Edit / Delete affordances
 * on the entries header — the snackbar stub is gone.
 */
@Component({
  selector: 'app-customer-pricing-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    MatTooltipModule,
    SelectComponent, EmptyStateComponent,
    PriceListEntriesTableComponent,
  ],
  templateUrl: './customer-pricing-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPricingTabComponent implements OnInit {
  private readonly priceListsService = inject(PriceListsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customerId = input.required<number>();

  protected readonly priceLists = signal<PriceList[]>([]);
  protected readonly entries = signal<PriceListEntry[]>([]);
  protected readonly listsLoading = signal(false);
  protected readonly entriesLoading = signal(false);
  /** Mirror of `selectedListControl.value` so computeds react to changes. */
  protected readonly selectedListId = signal<number | null>(null);

  protected readonly selectedListControl = new FormControl<number | null>(null);

  protected readonly listOptions = computed<SelectOption[]>(() =>
    this.priceLists().map(pl => ({ value: pl.id, label: pl.name })),
  );

  protected readonly selectedList = computed<PriceList | null>(() => {
    const id = this.selectedListId();
    if (id == null) return null;
    return this.priceLists().find(pl => pl.id === id) ?? null;
  });

  ngOnInit(): void {
    this.loadLists();
    // When the user picks a different list, refresh entries. CLAUDE.md
    // efficiency rule: every long-lived subscribe needs takeUntilDestroyed.
    this.selectedListControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => {
        this.selectedListId.set(id);
        if (id != null) this.loadEntries(id);
        else this.entries.set([]);
      });
  }

  private loadLists(selectListId?: number): void {
    this.listsLoading.set(true);
    this.priceListsService.listForCustomer(this.customerId()).subscribe({
      next: lists => {
        this.priceLists.set(lists);
        this.listsLoading.set(false);
        // Auto-select: explicit selectListId (post-create) wins, then
        // default, then first available.
        const preferred =
          (selectListId != null ? lists.find(l => l.id === selectListId) : null)
          ?? lists.find(l => l.isDefault)
          ?? lists[0]
          ?? null;
        if (preferred) {
          this.selectedListControl.setValue(preferred.id, { emitEvent: false });
          this.selectedListId.set(preferred.id);
          this.loadEntries(preferred.id);
        } else {
          this.selectedListControl.setValue(null, { emitEvent: false });
          this.selectedListId.set(null);
          this.entries.set([]);
        }
      },
      error: () => this.listsLoading.set(false),
    });
  }

  private loadEntries(priceListId: number): void {
    this.entriesLoading.set(true);
    this.priceListsService.getEntries(priceListId, { pageSize: 200 }).subscribe({
      next: page => {
        this.entries.set(page.items);
        this.entriesLoading.set(false);
      },
      error: () => this.entriesLoading.set(false),
    });
  }

  /**
   * Format the parent list's effective range for the header subtitle.
   * Falls back to "Always" when both bounds are null.
   */
  protected formatRange(list: PriceList): string {
    const fmt = (iso: string | null) => {
      if (!iso) return null;
      const d = new Date(iso);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${m}/${day}/${d.getFullYear()}`;
    };
    const from = fmt(list.effectiveFrom);
    const to = fmt(list.effectiveTo);
    if (!from && !to) return 'Always';
    if (from && !to) return `From ${from}`;
    if (!from && to) return `Until ${to}`;
    return `${from} – ${to}`;
  }

  // -------- List CRUD --------

  protected createNewList(): void {
    this.openListDialog(null);
  }

  protected editList(list: PriceList): void {
    this.openListDialog(list);
  }

  protected deleteList(list: PriceList): void {
    const entryCount = list.entryCount ?? this.entries().length;
    const baseMessage = this.translate.instant('priceList.confirmDelete', { name: list.name });
    const fullMessage = entryCount > 0
      ? `${baseMessage} ${this.translate.instant('priceList.confirmDeleteEntries', { count: entryCount })}`
      : baseMessage;

    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('common.delete'),
        message: fullMessage,
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.priceListsService.delete(list.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('priceList.deletedSuccess'));
          // After delete, fall back to default / first list.
          this.loadLists();
        },
      });
    });
  }

  private openListDialog(priceList: PriceList | null): void {
    this.dialog.open(PriceListFormDialogComponent, {
      width: '520px',
      data: {
        priceList,
        customerId: this.customerId(),
      } satisfies PriceListFormDialogData,
    }).afterClosed().subscribe((result: PriceList | null | undefined) => {
      if (!result) return;
      // After create OR edit: refresh the lists, select the saved one so
      // the header shows the new / updated metadata.
      this.loadLists(result.id);
    });
  }

  // -------- Entry CRUD (delegated to entry dialog) --------

  protected onAdd(): void {
    const list = this.selectedList();
    if (!list) return;
    this.openEntryDialog(null, list.id);
  }

  protected onEdit(entry: PriceListEntry): void {
    this.openEntryDialog(entry, entry.priceListId);
  }

  protected onDelete(entry: PriceListEntry): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('common.delete'),
        message: this.translate.instant('customers.pricing.confirmDelete'),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.priceListsService.deleteEntry(entry.id).subscribe({
        next: () => {
          this.snackbar.success('Price entry removed');
          if (this.selectedList()) this.loadEntries(this.selectedList()!.id);
        },
      });
    });
  }

  /**
   * Inline-cell save (Pattern D — see `phase-4-output/pricelist-entry-edit-ux.md`).
   * The table component has already PUT the row; we splice the updated
   * entry into the local cache so the next render reflects it without
   * refetching the whole page.
   */
  protected onCellSaved(updated: PriceListEntry): void {
    this.entries.update(rows => rows.map(e => e.id === updated.id ? updated : e));
    this.snackbar.success(this.translate.instant('priceListEntry.cellSaved'));
  }

  private openEntryDialog(entry: PriceListEntry | null, priceListId: number): void {
    this.dialog.open(PriceListEntryFormDialogComponent, {
      width: '520px',
      data: { entry, priceListId } satisfies PriceListEntryFormDialogData,
    }).afterClosed().subscribe(result => {
      if (result) this.loadEntries(priceListId);
    });
  }

  // -------- CSV bulk import --------

  /**
   * Open the bulk-import dialog for the currently-selected price list. The
   * dialog runs the two-step (preview → apply) flow itself; on close, the
   * apply result reaches us when the user committed and we refresh the
   * entries table.
   */
  protected openBulkImport(): void {
    const list = this.selectedList();
    if (!list) return;
    this.dialog.open(PriceListEntryBulkImportDialogComponent, {
      width: '800px',
      data: { priceListId: list.id, priceListName: list.name } satisfies PriceListEntryBulkImportDialogData,
    }).afterClosed().subscribe(result => {
      if (result) this.loadEntries(list.id);
    });
  }
}
