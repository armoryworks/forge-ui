import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { CostingComponent } from './costing.component';
import { WorkCenterCostRate, workCenterRateLabel } from './models/costing.model';
import { CostingService } from './services/costing.service';

interface CostingHarness {
  costCenterForm: FormGroup;
  poolForm: FormGroup;
}

describe('CostingComponent forms', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ tab: 'pools' })), queryParamMap: of(convertToParamMap({})) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: CostingService,
          useValue: { listPeriods: vi.fn(() => of([])), listCostCenters: vi.fn(() => of([])), listPools: vi.fn(() => of([])) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  function create(): CostingHarness {
    return TestBed.runInInjectionContext(() => new CostingComponent()) as unknown as CostingHarness;
  }

  it('rejects a negative square footage or headcount', () => {
    const { costCenterForm } = create();
    costCenterForm.patchValue({ code: 'CC', name: 'Molding', sqft: -500, headcount: -1 });

    expect(costCenterForm.get('sqft')!.hasError('min')).toBe(true);
    expect(costCenterForm.get('headcount')!.hasError('min')).toBe(true);
    expect(costCenterForm.invalid).toBe(true);
  });

  it('takes the fixed portion as a 0 to 1 fraction', () => {
    const { poolForm } = create();
    const fixedPortion = poolForm.get('fixedPortion')!;

    fixedPortion.setValue(150);
    expect(fixedPortion.hasError('max')).toBe(true);

    fixedPortion.setValue(0.4);
    expect(fixedPortion.valid).toBe(true);
  });

  it('requires the fixed portion only for a semi-variable pool', () => {
    const { poolForm } = create();
    const fixedPortion = poolForm.get('fixedPortion')!;

    expect(fixedPortion.hasError('required')).toBe(false);

    poolForm.get('behavior')!.setValue('Semi');
    expect(fixedPortion.hasError('required')).toBe(true);

    poolForm.get('behavior')!.setValue('Variable');
    expect(fixedPortion.hasError('required')).toBe(false);
  });
});

describe('workCenterRateLabel', () => {
  const rate = (code: string | null, name: string | null): WorkCenterCostRate => ({
    id: 1, workCenterId: 7, costingPeriodId: 2, laborRate: 32, laborOhRate: 0, machineRate: 0,
    machineOhVarRate: 0, machineOhFixedRate: 0, frozenAt: null, frozenBy: null,
    workCenterCode: code, workCenterName: name,
  });

  it('shows the code and name, then whichever is present, then the id', () => {
    expect(workCenterRateLabel(rate('WC-ASM', 'Assembly Bench'))).toBe('WC-ASM — Assembly Bench');
    expect(workCenterRateLabel(rate('WC-ASM', null))).toBe('WC-ASM');
    expect(workCenterRateLabel(rate(null, null))).toBe('#7');
  });
});
