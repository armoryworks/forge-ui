import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SankeyReportService } from '../../services/sankey-report.service';
import { SankeyFlowItem } from '../../models/sankey-flow-item.model';
import { SankeyReportType } from '../../models/sankey-report-type.type';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SankeyChartComponent } from '../../../../shared/components/sankey-chart/sankey-chart.component';
import { toIsoDate } from '../../../../shared/utils/date.utils';

interface SankeyReportDef {
  id: SankeyReportType;
  label: string;
  icon: string;
  needsDateRange: boolean;
}

@Component({
  selector: 'app-sankey-reports',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, PageHeaderComponent, DatepickerComponent, SankeyChartComponent],
  templateUrl: './sankey-reports.component.html',
  styleUrl: './sankey-reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SankeyReportsComponent {
  private readonly sankeyService = inject(SankeyReportService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly reports: SankeyReportDef[] = [
    { id: 'quote-to-cash', label: this.translate.instant('reports.sankey.quoteToCash'), icon: 'paid', needsDateRange: true },
    { id: 'job-stage-flow', label: this.translate.instant('reports.sankey.jobStageFlow'), icon: 'view_kanban', needsDateRange: false },
    { id: 'material-to-product', label: this.translate.instant('reports.sankey.materialToProduct'), icon: 'category', needsDateRange: false },
    { id: 'worker-orders', label: this.translate.instant('reports.sankey.workerOrders'), icon: 'engineering', needsDateRange: false },
    { id: 'expense-flow', label: this.translate.instant('reports.sankey.expenseFlow'), icon: 'account_balance_wallet', needsDateRange: true },
    { id: 'vendor-supply-chain', label: this.translate.instant('reports.sankey.vendorSupplyChain'), icon: 'local_shipping', needsDateRange: false },
    { id: 'quality-rejection', label: this.translate.instant('reports.sankey.qualityRejection'), icon: 'verified', needsDateRange: true },
    { id: 'inventory-location', label: this.translate.instant('reports.sankey.inventoryLocation'), icon: 'warehouse', needsDateRange: false },
    { id: 'customer-revenue', label: this.translate.instant('reports.sankey.customerRevenue'), icon: 'attach_money', needsDateRange: true },
    { id: 'training-completion', label: this.translate.instant('reports.sankey.trainingCompletion'), icon: 'school', needsDateRange: false },
  ];

  protected readonly activeReport = signal<SankeyReportType>('quote-to-cash');
  protected readonly loading = signal(false);
  protected readonly flowData = signal<SankeyFlowItem[]>([]);
  protected readonly activeReportDef = computed(() => this.reports.find(r => r.id === this.activeReport())!);

  protected readonly startControl = new FormControl<Date | null>(this.defaultStart());
  protected readonly endControl = new FormControl<Date | null>(this.defaultEnd());

  constructor() {
    this.loadReport();
  }

  protected selectReport(id: SankeyReportType): void {
    this.activeReport.set(id);
    this.loadReport();
  }

  protected loadReport(): void {
    this.loading.set(true);
    const report = this.activeReport();
    const start = this.startControl.value ? toIsoDate(this.startControl.value) || undefined : undefined;
    const end = this.endControl.value ? toIsoDate(this.endControl.value) || undefined : undefined;

    const obs = this.getReportObservable(report, start, end);
    obs.subscribe({
      next: (data) => {
        this.flowData.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected goBack(): void {
    this.router.navigate(['/reports']);
  }

  private getReportObservable(report: SankeyReportType, start?: string, end?: string) {
    switch (report) {
      case 'quote-to-cash': return this.sankeyService.getQuoteToCash(start, end);
      case 'job-stage-flow': return this.sankeyService.getJobStageFlow();
      case 'material-to-product': return this.sankeyService.getMaterialToProduct();
      case 'worker-orders': return this.sankeyService.getWorkerOrders();
      case 'expense-flow': return this.sankeyService.getExpenseFlow(start, end);
      case 'vendor-supply-chain': return this.sankeyService.getVendorSupplyChain();
      case 'quality-rejection': return this.sankeyService.getQualityRejection(start, end);
      case 'inventory-location': return this.sankeyService.getInventoryLocation();
      case 'customer-revenue': return this.sankeyService.getCustomerRevenue(start, end);
      case 'training-completion': return this.sankeyService.getTrainingCompletion();
    }
  }

  private defaultStart(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d;
  }

  private defaultEnd(): Date {
    return new Date();
  }
}
