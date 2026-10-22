import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { SankeyReportsComponent } from './sankey-reports.component';
import { SankeyReportService } from '../../services/sankey-report.service';
import { SankeyFlowItem } from '../../models/sankey-flow-item.model';
import { SankeyReportType } from '../../models/sankey-report-type.type';

interface SankeyInternals {
  flowData(): SankeyFlowItem[];
  loadError(): boolean;
  activeReport(): SankeyReportType;
  reportPicker: FormControl<SankeyReportType>;
  loadReport(): void;
}

describe('SankeyReportsComponent', () => {
  let getQuoteToCash: ReturnType<typeof vi.fn>;
  let getCustomerRevenue: ReturnType<typeof vi.fn>;

  function create(): SankeyInternals {
    return TestBed.runInInjectionContext(() => new SankeyReportsComponent()) as unknown as SankeyInternals;
  }

  beforeEach(() => {
    getQuoteToCash = vi.fn(() => of([{ from: 'Quotes', to: 'Sales Orders', flow: 2 }]));
    getCustomerRevenue = vi.fn(() => of([]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: SankeyReportService, useValue: { getQuoteToCash, getCustomerRevenue } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
  });

  it('shows an error state instead of the previous flows when loading fails', () => {
    const component = create();
    expect(component.flowData().length).toBe(1);

    getQuoteToCash.mockReturnValueOnce(throwError(() => new Error('500')));
    component.loadReport();

    expect(component.loadError()).toBe(true);
    expect(component.flowData()).toEqual([]);
  });

  it('switches diagram from the narrow-screen picker', () => {
    const component = create();

    component.reportPicker.setValue('customer-revenue');

    expect(component.activeReport()).toBe('customer-revenue');
    expect(getCustomerRevenue).toHaveBeenCalled();
  });
});
