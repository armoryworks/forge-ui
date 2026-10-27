import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';

import { ReportsComponent } from './reports.component';
import { ReportService } from './services/report.service';
import { AuthService } from '../../shared/services/auth.service';
import { ArAgingItem } from './models/ar-aging-item.model';
import { JobMarginItem } from './models/job-margin-item.model';
import { JobsByStageItem } from './models/jobs-by-stage-item.model';
import { ReportType } from './models/report-type.type';

interface ReportsInternals {
  loading(): boolean;
  loadError(): boolean;
  activeReport(): ReportType;
  arAgingData(): ArAgingItem[];
  jobsByStageData(): JobsByStageItem[];
  jobMarginData: { set(rows: JobMarginItem[]): void };
  simplePnlData: { set(rows: { category: string; type: string; amount: number }[]): void };
  pnlTotals(): { revenue: number; otherIncome: number; expenses: number; net: number };
  jobMarginTotals(): { avgMarginPct: number | null; measuredCount: number; jobCount: number; totalRevenue: number; totalMargin: number };
  jobMarginChart(): { labels?: unknown[] };
  reportPicker: FormControl<string>;
  selectReport(id: ReportType): void;
}

function marginRow(revenue: number, totalCost: number): JobMarginItem {
  return {
    jobNumber: `J-${revenue}-${totalCost}`, title: 'Job', customerName: null,
    revenue, laborCost: totalCost, materialCost: 0, expenseCost: 0, totalCost,
    margin: totalCost > 0 ? revenue - totalCost : null,
    marginPercentage: revenue > 0 && totalCost > 0 ? (revenue - totalCost) / revenue * 100 : null,
    costRecorded: totalCost > 0,
  };
}

describe('ReportsComponent', () => {
  let reportService: Record<string, ReturnType<typeof vi.fn>>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  function create(): ReportsInternals {
    return TestBed.runInInjectionContext(() => new ReportsComponent()) as unknown as ReportsInternals;
  }

  beforeEach(() => {
    reportService = {
      getJobsByStage: vi.fn(() => of([{ stageName: 'Cut', count: 2 }])),
      getArAging: vi.fn(() => of([])),
      getJobMargin: vi.fn(() => of([])),
    };
    router = { navigate: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: ReportService, useValue: reportService },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('keeps other income out of revenue on the simple P&L but in net income', () => {
    const component = create();
    component.simplePnlData.set([
      { category: '40000 Sales Revenue', type: 'Revenue', amount: 730 },
      { category: '90000 Foreign Exchange Gain', type: 'OtherIncome', amount: 20 },
      { category: '61500 Marketplace Fees', type: 'Expense', amount: 37.5 },
    ]);

    expect(component.pnlTotals()).toEqual({ revenue: 730, otherIncome: 20, expenses: 37.5, net: 712.5 });
  });

  it('shows an error state and clears old rows when a report fails to load', () => {
    const rows = [{ invoiceNumber: 'INV-1', balanceDue: 10 } as ArAgingItem];
    reportService['getArAging'].mockReturnValueOnce(of(rows));
    const component = create();

    component.selectReport('ar-aging');
    expect(component.arAgingData()).toEqual(rows);

    reportService['getArAging'].mockReturnValueOnce(throwError(() => new Error('500')));
    component.selectReport('ar-aging');

    expect(component.loadError()).toBe(true);
    expect(component.loading()).toBe(false);
    expect(component.arAgingData()).toEqual([]);
  });

  it('ignores a late response for a report the user already left', () => {
    const slow = new Subject<ArAgingItem[]>();
    reportService['getArAging'].mockReturnValueOnce(slow);
    const component = create();

    component.selectReport('ar-aging');
    component.selectReport('jobs-by-stage');
    slow.next([{ invoiceNumber: 'INV-LATE' } as ArAgingItem]);

    expect(component.arAgingData()).toEqual([]);
    expect(component.loading()).toBe(false);
    expect(component.loadError()).toBe(false);
  });

  it('weights the average margin by revenue and skips rows without cost or revenue', () => {
    const component = create();

    component.jobMarginData.set([marginRow(9000, 8100), marginRow(1000, 1), marginRow(5000, 0), marginRow(0, 200)]);

    const totals = component.jobMarginTotals();
    expect(totals.avgMarginPct).toBe(19);
    expect(totals.measuredCount).toBe(2);
    expect(totals.jobCount).toBe(4);
  });

  it('leaves uncosted and uninvoiced jobs out of the total margin and the margin chart', () => {
    const component = create();

    component.jobMarginData.set([marginRow(1000, 600), marginRow(5000, 0), marginRow(0, 200)]);

    expect(component.jobMarginTotals().totalMargin).toBe(400);
    expect(component.jobMarginChart().labels).toEqual(['J-1000-600', 'J-0-200']);
  });

  it('withholds the average margin when no row has both cost and revenue', () => {
    const component = create();

    component.jobMarginData.set([marginRow(5000, 0)]);

    expect(component.jobMarginTotals().avgMarginPct).toBeNull();
  });

  it('switches report from the narrow-screen picker', () => {
    const component = create();

    component.reportPicker.setValue('ar-aging');

    expect(component.activeReport()).toBe('ar-aging');
    expect(reportService['getArAging']).toHaveBeenCalled();
  });

  it('opens the sankey page from the narrow-screen picker', () => {
    const component = create();

    component.reportPicker.setValue('sankey');

    expect(router.navigate).toHaveBeenCalledWith(['/reports/sankey']);
  });
});
