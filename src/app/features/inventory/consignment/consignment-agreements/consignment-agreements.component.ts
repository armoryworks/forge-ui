import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConsignmentService } from '../services/consignment.service';
import { ConsignmentAgreement } from '../models/consignment-agreement.model';
import { ConsignmentAgreementStock } from '../models/consignment-agreement-stock.model';
import { ConsignmentStockSummary } from '../models/consignment-stock-summary.model';
import { ConsignmentTransaction } from '../models/consignment-transaction.model';
import { ConsignmentAction } from '../models/consignment-action.type';
import { ConsignmentAgreementDialogComponent } from '../components/consignment-agreement-dialog/consignment-agreement-dialog.component';
import { ConsignmentActionDialogComponent } from '../components/consignment-action-dialog/consignment-action-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DetailSidePanelComponent } from '../../../../shared/components/detail-side-panel/detail-side-panel.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

const STATUS_CHIPS: Record<string, string> = {
  Draft: 'chip chip--muted',
  Active: 'chip chip--success',
  Suspended: 'chip chip--warning',
  Expired: 'chip chip--muted',
  Terminated: 'chip chip--muted',
};

interface AgreementRow extends ConsignmentAgreementStock {
  statusClass: string;
  stockFlagKey: string | null;
}

/**
 * Purchasing > Consignment: inbound agreements with the vendor-owned stock each one holds in our bins, what has
 * been used and not yet billed, and the receive / consume / reconcile actions. The selected agreement is in the URL
 * (`?agreement=id`).
 */
@Component({
  selector: 'app-consignment-agreements',
  standalone: true,
  imports: [
    TranslatePipe,
    PageHeaderComponent, DataTableComponent, CurrencyDisplayComponent, DetailSidePanelComponent, EntityLinkComponent,
    ColumnCellDirective, LoadingBlockDirective, DateOnlyPipe,
    ConsignmentAgreementDialogComponent, ConsignmentActionDialogComponent,
  ],
  templateUrl: './consignment-agreements.component.html',
  styleUrl: './consignment-agreements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsignmentAgreementsComponent {
  private readonly service = inject(ConsignmentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly summary = signal<ConsignmentStockSummary | null>(null);
  protected readonly agreements = signal<ConsignmentAgreement[]>([]);
  protected readonly transactions = signal<ConsignmentTransaction[]>([]);
  protected readonly showAgreementDialog = signal(false);
  protected readonly editingAgreement = signal<ConsignmentAgreement | null>(null);
  protected readonly action = signal<ConsignmentAction | null>(null);

  private readonly selectedId = toSignal(
    this.route.queryParamMap.pipe(map(p => Number(p.get('agreement')) || null)), { initialValue: null });

  protected readonly rows = computed<AgreementRow[]>(() =>
    (this.summary()?.agreements ?? [])
      .filter(a => a.direction === 'Inbound')
      .map(a => ({
        ...a,
        statusClass: STATUS_CHIPS[a.status] ?? 'chip',
        stockFlagKey: a.belowMinimum ? 'consignment.belowMin' : a.aboveMaximum ? 'consignment.aboveMax' : null,
      })));

  protected readonly selected = computed(() => this.rows().find(r => r.agreementId === this.selectedId()) ?? null);
  protected readonly selectedAgreement = computed(() => this.agreements().find(a => a.id === this.selectedId()) ?? null);

  protected readonly columns: ColumnDef[] = [
    { field: 'ownerName', header: this.translate.instant('consignment.vendor'), sortable: true },
    { field: 'partNumber', header: this.translate.instant('common.part'), sortable: true },
    { field: 'agreedUnitPrice', header: this.translate.instant('consignment.agreedPrice'), sortable: true, align: 'right', width: '120px' },
    { field: 'onHandQuantity', header: this.translate.instant('consignment.onHand'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'onHandValue', header: this.translate.instant('consignment.onHandValue'), sortable: true, align: 'right', width: '120px', phoneHidden: true },
    { field: 'unbilledQuantity', header: this.translate.instant('consignment.unbilled'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'stockFlag', header: this.translate.instant('consignment.stockLevel'), sortable: false, width: '130px', phoneHidden: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
  ];

  protected readonly transactionColumns: ColumnDef[] = [
    { field: 'createdAt', header: this.translate.instant('common.date'), sortable: true, width: '96px' },
    { field: 'type', header: this.translate.instant('common.type'), sortable: true },
    { field: 'quantity', header: this.translate.instant('common.quantity'), sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'extendedAmount', header: this.translate.instant('common.amount'), sortable: true, align: 'right', width: '110px' },
    { field: 'reference', header: this.translate.instant('consignment.reference'), sortable: false },
  ];

  constructor() {
    this.load();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const id = Number(p.get('agreement'));
      if (id) this.loadTransactions(id);
      else this.transactions.set([]);
    });
  }

  protected load(): void {
    this.loading.set(true);
    forkJoin({ summary: this.service.stockSummary(), agreements: this.service.agreements() }).subscribe({
      next: ({ summary, agreements }) => {
        this.summary.set(summary);
        this.agreements.set(agreements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTransactions(id: number): void {
    this.service.transactions(id).subscribe({
      next: list => this.transactions.set(list),
      error: () => this.transactions.set([]),
    });
  }

  protected select(row: unknown): void {
    this.setSelected((row as AgreementRow).agreementId);
  }

  protected closePanel(): void {
    this.setSelected(null);
  }

  private setSelected(id: number | null): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { agreement: id }, queryParamsHandling: 'merge' });
  }

  protected openNew(): void {
    this.editingAgreement.set(null);
    this.showAgreementDialog.set(true);
  }

  protected openEdit(): void {
    this.editingAgreement.set(this.selectedAgreement());
    this.showAgreementDialog.set(true);
  }

  protected onAgreementSaved(agreement: ConsignmentAgreement): void {
    this.showAgreementDialog.set(false);
    this.load();
    this.setSelected(agreement.id);
  }

  protected onActionDone(): void {
    this.load();
    const id = this.selectedId();
    if (id) this.loadTransactions(id);
  }
}
