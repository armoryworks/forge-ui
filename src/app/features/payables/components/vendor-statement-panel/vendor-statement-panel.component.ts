import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorStatement } from '../../models/vendor-statement.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

/** Payables > Vendor statement: a vendor's open bills and open credits (negative), netted per currency. */
@Component({
  selector: 'app-vendor-statement-panel',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DateOnlyPipe, DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, SelectComponent, LoadingBlockDirective],
  templateUrl: './vendor-statement-panel.component.html',
  styleUrl: './vendor-statement-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorStatementPanelComponent {
  private readonly service = inject(VendorCreditMemoService);
  private readonly translate = inject(TranslateService);

  readonly vendorOptions = input<SelectOption[]>([]);

  protected readonly vendorControl = new FormControl<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly statement = signal<VendorStatement | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'documentType', header: this.translate.instant('vendorStatement.document'), width: '150px' },
    { field: 'documentNumber', header: this.translate.instant('vendorStatement.number'), width: '130px' },
    { field: 'vendorReference', header: this.translate.instant('vendorStatement.vendorReference'), width: '140px' },
    { field: 'documentDate', header: this.translate.instant('common.date'), type: 'date', width: '110px' },
    { field: 'dueDate', header: this.translate.instant('common.dueDate'), type: 'date', width: '110px' },
    { field: 'originalAmount', header: this.translate.instant('common.total'), width: '120px', align: 'right' },
    { field: 'openAmount', header: this.translate.instant('vendorStatement.open'), width: '120px', align: 'right' },
  ];

  constructor() {
    this.vendorControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(id => this.load(id));
  }

  protected load(vendorId: number | null): void {
    this.statement.set(null);
    if (!vendorId) return;
    this.loading.set(true);
    this.service.getStatement(vendorId).subscribe({
      next: statement => {
        this.statement.set(statement);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
