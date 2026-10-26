import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PaymentTermsService } from '../../../shared/services/payment-terms.service';
import { PaymentTerm } from '../../../shared/models/payment-term.model';
import { PaymentTermRequest } from '../../../shared/models/payment-term-request.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PaymentTermDialogComponent, PaymentTermDialogData } from './payment-term-dialog.component';

/**
 * Admin > Payment terms: the terms customers, vendors, orders, invoices and bills pick from, with their net days
 * and early-payment discount. Seeded system terms can be renamed only; tenant terms can be edited or deactivated.
 */
@Component({
  selector: 'app-payment-terms-admin',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, SpacerDirective, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './payment-terms-admin.component.html',
  styleUrl: './payment-terms-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTermsAdminComponent {
  private readonly service = inject(PaymentTermsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly terms = signal<PaymentTerm[]>([]);
  protected readonly loading = signal(true);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('paymentTerms.fieldName'), sortable: true },
    { field: 'code', header: this.translate.instant('paymentTerms.fieldCode'), sortable: true, width: '140px' },
    { field: 'netDays', header: this.translate.instant('paymentTerms.fieldNetDays'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'discountPercent', header: this.translate.instant('paymentTerms.fieldDiscountPercent'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'discountDays', header: this.translate.instant('paymentTerms.fieldDiscountDays'), sortable: true, type: 'number', align: 'right', width: '120px' },
    { field: 'isSystem', header: this.translate.instant('paymentTerms.colSystem'), width: '100px', align: 'center' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
  ];

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.list(true).subscribe({
      next: list => {
        this.terms.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openNew(): void {
    this.openDialog({});
  }

  protected openEdit(term: PaymentTerm): void {
    this.openDialog({ term });
  }

  private openDialog(data: PaymentTermDialogData): void {
    this.dialog.open<PaymentTermDialogComponent, PaymentTermDialogData, PaymentTermRequest>(PaymentTermDialogComponent, { width: '520px', data })
      .afterClosed()
      .subscribe(request => {
        if (!request) return;
        const save = data.term ? this.service.update(data.term.id, request) : this.service.create(request);
        save.subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('paymentTerms.saved'));
            this.load();
          },
        });
      });
  }
}
