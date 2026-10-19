import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { CostingComponent } from './costing.component';
import { CostingService } from './services/costing.service';
import { CostingPeriod } from './models/costing.model';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';

interface CostingInternals {
  periodForm: FormGroup;
  costCenterForm: FormGroup;
  poolForm: FormGroup;
  budgetForm: FormGroup;
  createPeriod(): void;
  freeze(period: CostingPeriod): void;
  createCostCenter(): void;
  createPool(): void;
  setBudget(): void;
}

describe('CostingComponent · one request per press', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let view: CostingInternals;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = {
      listPeriods: vi.fn(() => of([])),
      listCostCenters: vi.fn(() => of([])),
      listPools: vi.fn(() => of([])),
      getTemplates: vi.fn(() => of([])),
      createPeriod: vi.fn(() => new Subject()),
      freezePeriod: vi.fn(() => new Subject()),
      createCostCenter: vi.fn(() => new Subject()),
      createPool: vi.fn(() => new Subject()),
      upsertBudget: vi.fn(() => new Subject()),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CostingService, useValue: service },
        { provide: ActivatedRoute, useValue: {
          paramMap: new BehaviorSubject(convertToParamMap({ tab: 'periods' })),
          queryParamMap: new BehaviorSubject(convertToParamMap({})),
        } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new CostingComponent()) as unknown as CostingInternals;
  });

  it('creates one period when Create is pressed twice before the server answers', () => {
    view.periodForm.setValue({ start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) });

    view.createPeriod();
    view.createPeriod();

    expect(service['createPeriod']).toHaveBeenCalledTimes(1);
  });

  it('lets Create be pressed again after the server rejects the period', () => {
    service['createPeriod'].mockReturnValue(throwError(() => new Error('409')));
    view.periodForm.setValue({ start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) });

    view.createPeriod();
    view.createPeriod();

    expect(service['createPeriod']).toHaveBeenCalledTimes(2);
  });

  it('freezes a period once on a double press', () => {
    view.freeze({ id: 3 } as CostingPeriod);
    view.freeze({ id: 3 } as CostingPeriod);

    expect(service['freezePeriod']).toHaveBeenCalledTimes(1);
  });

  it('creates one cost center on a double press', () => {
    view.costCenterForm.patchValue({ code: 'CC1', name: 'Machining' });

    view.createCostCenter();
    view.createCostCenter();

    expect(service['createCostCenter']).toHaveBeenCalledTimes(1);
  });

  it('creates one overhead pool on a double press', () => {
    view.poolForm.patchValue({ costingCostCenterId: 1, code: 'P1', name: 'Power' });

    view.createPool();
    view.createPool();

    expect(service['createPool']).toHaveBeenCalledTimes(1);
  });

  it('sets a budget once on a double press', () => {
    view.budgetForm.setValue({ overheadCostPoolId: 1, costingPeriodId: 2, budgetAmount: 1000, budgetDriverQty: 10 });

    view.setBudget();
    view.setBudget();

    expect(service['upsertBudget']).toHaveBeenCalledTimes(1);
  });
});
