import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AutoPoService } from '../../services/auto-po.service';
import { AutoPoSuggestion } from '../../models/auto-po-suggestion.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-auto-po-suggestions',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe, MatTooltipModule,
    DataTableComponent, ColumnCellDirective, SelectComponent, LoadingBlockDirective,
  ],
  templateUrl: './auto-po-suggestions.component.html',
  styleUrl: './auto-po-suggestions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoPoSuggestionsComponent {
  private readonly autoPoService = inject(AutoPoService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly suggestions = signal<AutoPoSuggestion[]>([]);

  protected readonly statusFilterControl = new FormControl<string | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    { value: 'Pending', label: this.translate.instant('autoPo.statusPending') },
    { value: 'Converted', label: this.translate.instant('autoPo.statusConverted') },
    { value: 'Dismissed', label: this.translate.instant('autoPo.statusDismissed') },
  ];

  protected readonly pendingCount = computed(() =>
    this.suggestions().filter(s => s.status === 'Pending').length,
  );

  protected readonly columns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('purchaseOrders.partNumber'), sortable: true, width: '120px' },
    { field: 'partDescription', header: this.translate.instant('common.description'), sortable: true },
    { field: 'vendorName', header: this.translate.instant('purchaseOrders.vendor'), sortable: true },
    { field: 'suggestedQty', header: this.translate.instant('autoPo.suggestedQty'), sortable: true, width: '100px', align: 'center' },
    { field: 'neededByDate', header: this.translate.instant('autoPo.neededBy'), sortable: true, type: 'date', width: '110px' },
    { field: 'sourceSalesOrderIds', header: this.translate.instant('autoPo.sourceSalesOrders'), width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '120px',
      filterOptions: this.statusOptions.slice(1) },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  constructor() {
    this.loadSuggestions();
  }

  protected loadSuggestions(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.autoPoService.getSuggestions(status).subscribe({
      next: (list) => {
        this.suggestions.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilter(): void {
    this.loadSuggestions();
  }

  protected convertToPo(suggestion: AutoPoSuggestion): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('autoPo.convertTitle'),
        message: this.translate.instant('autoPo.convertMessage', { partNumber: suggestion.partNumber, qty: suggestion.suggestedQty }),
        confirmLabel: this.translate.instant('autoPo.convertToPo'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.autoPoService.convertSuggestion(suggestion.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('autoPo.convertSuccess'));
          this.loadSuggestions();
        },
      });
    });
  }

  protected dismiss(suggestion: AutoPoSuggestion): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('autoPo.dismissTitle'),
        message: this.translate.instant('autoPo.dismissMessage', { partNumber: suggestion.partNumber }),
        confirmLabel: this.translate.instant('autoPo.dismiss'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.autoPoService.dismissSuggestion(suggestion.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('autoPo.dismissSuccess'));
          this.loadSuggestions();
        },
      });
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

  protected getStatusLabel(status: string): string {
    const key = 'autoPo.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }
}
