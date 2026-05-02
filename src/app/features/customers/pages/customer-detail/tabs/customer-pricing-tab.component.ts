import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

import { PriceListEntriesTableComponent } from '../../../components/price-list-entries-cluster/price-list-entries-table.component';
import {
  PriceListEntryFormDialogComponent,
  PriceListEntryFormDialogData,
} from '../../../components/price-list-entries-cluster/price-list-entry-form-dialog.component';
import { PriceList, PriceListEntry } from '../../../models/price-list.model';
import { PriceListsService } from '../../../services/price-lists.service';

/**
 * Pillar 5 — Customer detail Pricing tab. Per the dispatch (research at
 * `phase-4-output/pricelist-entry-edit-ux.md`) this is Pattern B:
 *   • List-of-lists selector (when customer has &gt; 1 list).
 *   • For the selected list: `<app-price-list-entries-table>` row list +
 *     `<app-price-list-entry-form-dialog>` for create/edit.
 *
 * "Create new list" is intentionally a snackbar stub for this dispatch —
 * the list-creation UX is its own follow-up.
 */
@Component({
  selector: 'app-customer-pricing-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
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

  private loadLists(): void {
    this.listsLoading.set(true);
    this.priceListsService.listForCustomer(this.customerId()).subscribe({
      next: lists => {
        this.priceLists.set(lists);
        this.listsLoading.set(false);
        // Auto-select the default list, or the first one available.
        const preferred = lists.find(l => l.isDefault) ?? lists[0];
        if (preferred) {
          this.selectedListControl.setValue(preferred.id, { emitEvent: false });
          this.selectedListId.set(preferred.id);
          this.loadEntries(preferred.id);
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

  protected createNewList(): void {
    // Out of scope for this dispatch — list creation is its own UX.
    this.snackbar.info('Coming in a follow-up dispatch');
  }

  protected onAdd(): void {
    const list = this.selectedList();
    if (!list) return;
    this.openDialog(null, list.id);
  }

  protected onEdit(entry: PriceListEntry): void {
    this.openDialog(entry, entry.priceListId);
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

  private openDialog(entry: PriceListEntry | null, priceListId: number): void {
    this.dialog.open(PriceListEntryFormDialogComponent, {
      width: '520px',
      data: { entry, priceListId } satisfies PriceListEntryFormDialogData,
    }).afterClosed().subscribe(result => {
      if (result) this.loadEntries(priceListId);
    });
  }
}
