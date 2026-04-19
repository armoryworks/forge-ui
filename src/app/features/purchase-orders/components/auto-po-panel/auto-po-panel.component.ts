import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { AutoPoSuggestion, AutoPoSuggestionStatus } from '../../models/auto-po-suggestion.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';

@Component({
  selector: 'app-auto-po-panel',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    SelectComponent, EntityLinkComponent,
  ],
  templateUrl: './auto-po-panel.component.html',
  styleUrl: './auto-po-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoPoPanelComponent {
  private readonly poService = inject(PurchaseOrderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly converting = signal(false);
  protected readonly suggestions = signal<AutoPoSuggestion[]>([]);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly isAdmin = this.auth.hasRole('Admin');

  protected readonly statusFilterControl = new FormControl<AutoPoSuggestionStatus | null>('Pending');

  protected readonly statusFilterOptions: SelectOption[] = [
    { value: 'Pending', label: this.translate.instant('autoPo.statusPending') || 'Pending' },
    { value: 'Converted', label: this.translate.instant('autoPo.statusConverted') || 'Converted' },
    { value: 'Dismissed', label: this.translate.instant('autoPo.statusDismissed') || 'Dismissed' },
  ];

  protected readonly pendingCount = computed(() =>
    this.suggestions().filter(s => s.status === 'Pending').length,
  );

  protected readonly hasSelection = computed(() => this.selectedIds().length > 0);

  protected readonly columns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('autoPo.partNumber') || 'Part #', sortable: true, width: '120px' },
    { field: 'partDescription', header: this.translate.instant('autoPo.description') || 'Description', sortable: true },
    { field: 'vendorName', header: this.translate.instant('autoPo.vendor') || 'Vendor', sortable: true, width: '160px' },
    { field: 'suggestedQty', header: this.translate.instant('autoPo.qty') || 'Qty', sortable: true, width: '80px', align: 'center' },
    { field: 'neededByDate', header: this.translate.instant('autoPo.neededBy') || 'Needed By', sortable: true, type: 'date', width: '110px' },
    { field: 'sourceSalesOrderNumbers', header: this.translate.instant('autoPo.sourceSOs') || 'Source SOs', sortable: false, width: '140px' },
    { field: 'status', header: this.translate.instant('common.status') || 'Status', sortable: true, filterable: true, type: 'enum', width: '110px', filterOptions: this.statusFilterOptions },
    { field: 'createdAt', header: this.translate.instant('common.created') || 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.poService.getAutoPoSuggestions(status).subscribe({
      next: (data) => {
        this.suggestions.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onStatusFilterChange(): void {
    this.selectedIds.set([]);
    this.loadSuggestions();
  }

  protected onSelectionChange(rows: unknown[]): void {
    const items = rows as AutoPoSuggestion[];
    this.selectedIds.set(items.map(s => s.id));
  }

  protected convertSelected(): void {
    const ids = this.selectedIds();
    if (ids.length === 0) return;

    this.converting.set(true);
    if (ids.length === 1) {
      this.poService.convertSuggestion(ids[0]).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('autoPo.convertedSuccess') || 'Suggestion converted to PO');
          this.converting.set(false);
          this.selectedIds.set([]);
          this.loadSuggestions();
        },
        error: () => this.converting.set(false),
      });
    } else {
      this.poService.bulkConvertSuggestions(ids).subscribe({
        next: (poIds) => {
          this.snackbar.success(
            (this.translate.instant('autoPo.bulkConvertedSuccess') || '{{count}} suggestions converted to POs')
              .replace('{{count}}', String(poIds.length)),
          );
          this.converting.set(false);
          this.selectedIds.set([]);
          this.loadSuggestions();
        },
        error: () => this.converting.set(false),
      });
    }
  }

  protected dismissSelected(): void {
    const ids = this.selectedIds();
    if (ids.length === 0) return;

    this.converting.set(true);
    let completed = 0;
    let errors = 0;
    for (const id of ids) {
      this.poService.dismissSuggestion(id).subscribe({
        next: () => {
          completed++;
          if (completed + errors === ids.length) {
            this.finishDismiss(completed, errors);
          }
        },
        error: () => {
          errors++;
          if (completed + errors === ids.length) {
            this.finishDismiss(completed, errors);
          }
        },
      });
    }
  }

  private finishDismiss(completed: number, errors: number): void {
    if (errors === 0) {
      this.snackbar.success(
        (this.translate.instant('autoPo.dismissedSuccess') || '{{count}} suggestion(s) dismissed')
          .replace('{{count}}', String(completed)),
      );
    } else {
      this.snackbar.error(
        (this.translate.instant('autoPo.dismissedPartial') || '{{errors}} failed to dismiss')
          .replace('{{errors}}', String(errors)),
      );
    }
    this.converting.set(false);
    this.selectedIds.set([]);
    this.loadSuggestions();
  }

  protected triggerRun(): void {
    this.poService.triggerAutoPoRun().subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('autoPo.runTriggered') || 'Auto-PO analysis triggered');
      },
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Pending: 'chip--warning',
      Converted: 'chip--success',
      Dismissed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }
}
