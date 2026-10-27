import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PredictionsComponent } from './predictions.component';
import { PredictiveMaintenanceService } from '../../services/predictive-maintenance.service';
import { MaintenancePrediction } from '../../models/prediction.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface PredictionsView {
  severityControl: FormControl<string>;
  statusControl: FormControl<string>;
  filteredPredictions: Signal<MaintenancePrediction[]>;
  emptyMessageKey: Signal<string>;
  canRunNow: boolean;
  runNow(): void;
}

const ROWS = [
  { id: 1, severity: 'Critical', status: 'Predicted' },
  { id: 2, severity: 'Low', status: 'Predicted' },
  { id: 3, severity: 'Low', status: 'Resolved' },
] as MaintenancePrediction[];

const runAll = vi.fn(() => of({ workCenters: 3 }));

function create(rows: MaintenancePrediction[] = ROWS, roles = true): PredictionsView {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: PredictiveMaintenanceService, useValue: { list: vi.fn(() => of(rows)), getDashboard: vi.fn(() => of(null)), runAll } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: AuthService, useValue: { hasAnyRole: vi.fn(() => roles) } },
    ],
  });
  return TestBed.runInInjectionContext(() => new PredictionsComponent()) as unknown as PredictionsView;
}

describe('PredictionsComponent filters', () => {
  it('re-filters the table when the severity or status filter changes', () => {
    const view = create();
    expect(view.filteredPredictions().map(p => p.id)).toEqual([1, 2]);

    view.severityControl.setValue('Low');
    expect(view.filteredPredictions().map(p => p.id)).toEqual([2]);

    view.statusControl.setValue('all');
    expect(view.filteredPredictions().map(p => p.id)).toEqual([2, 3]);
  });

  it('tells the user to widen the filters only when filters hide rows', () => {
    const view = create();
    view.severityControl.setValue('High');
    expect(view.emptyMessageKey()).toBe('maintenance.emptyFiltered');

    expect(create([]).emptyMessageKey()).toBe('maintenance.empty');
  });
});

describe('PredictionsComponent run now', () => {
  it('lets Admin and Manager run the rules for every work center', () => {
    const view = create();
    expect(view.canRunNow).toBe(true);

    view.runNow();

    expect(runAll).toHaveBeenCalled();
  });

  it('hides run now from other roles', () => {
    expect(create(ROWS, false).canRunNow).toBe(false);
  });
});
