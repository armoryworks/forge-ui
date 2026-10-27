import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Signal } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AssetsService } from '../../../assets/services/assets.service';
import { SchedulingService } from '../../../scheduling/services/scheduling.service';
import { ProductionRunDialogData } from '../../models/production-run-dialog-data.model';
import { ProductionRun } from '../../models/production-run.model';
import { ProductionRunsService } from '../../services/production-runs.service';
import { ProductionRunDialogComponent } from './production-run-dialog.component';

interface DialogView {
  form: ProductionRunDialogComponent['form'];
  save(): void;
  ngOnInit(): void;
  showWorkCenter: boolean;
  showTooling: boolean;
  toolingOptions: Signal<{ value: unknown; label: string }[]>;
}

const RUN = {
  id: 11, jobId: 7, partId: 3, runNumber: 'RUN-1', targetQuantity: 2000, completedQuantity: 1000, scrapQuantity: 0,
  status: 'InProgress', notes: null, setupTimeMinutes: 10, runTimeMinutes: 50, runTimeManual: false, toolingAssetId: 9,
} as unknown as ProductionRun;

function setup(data: ProductionRunDialogData, picker = true) {
  const runs = { createRun: vi.fn(() => of(RUN)), updateRun: vi.fn(() => of(RUN)) };
  const assets = { getAssets: vi.fn(() => of([{ id: 9, name: 'Mold A', cavityCount: 4, status: 'Active' }])) };
  const scheduling = { getWorkCenters: vi.fn(() => of([{ id: 4, code: 'P1', name: 'Press 1', isActive: true }])) };
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
      { provide: ProductionRunsService, useValue: runs },
      { provide: AssetsService, useValue: assets },
      { provide: SchedulingService, useValue: scheduling },
      { provide: AuthService, useValue: { hasAnyRole: vi.fn(() => picker) } },
      { provide: CapabilityService, useValue: { isEnabled: vi.fn(() => true) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new ProductionRunDialogComponent()) as unknown as DialogView;
  view.ngOnInit();
  return { view, runs, assets, scheduling, close };
}

describe('ProductionRunDialogComponent', () => {
  it('creates a run with the chosen work center and tooling', () => {
    const { view, runs, close } = setup({ jobId: 7, partId: 3, defaultTargetQuantity: 2000, run: null });
    view.form.patchValue({ workCenterId: 4, toolingAssetId: 9 });

    view.save();

    expect(runs.createRun).toHaveBeenCalledWith(7, expect.objectContaining({ partId: 3, targetQuantity: 2000, workCenterId: 4, toolingAssetId: 9 }));
    expect(close).toHaveBeenCalledWith(RUN);
  });

  it('leaves work center and tooling to the server for roles that cannot list them', () => {
    const { view, runs, assets, scheduling } = setup({ jobId: 7, partId: 3, defaultTargetQuantity: 50, run: null }, false);

    expect(view.showWorkCenter).toBe(false);
    expect(view.showTooling).toBe(false);
    expect(assets.getAssets).not.toHaveBeenCalled();
    expect(scheduling.getWorkCenters).not.toHaveBeenCalled();
    view.save();
    expect(runs.createRun).toHaveBeenCalledWith(7, expect.objectContaining({ workCenterId: null, toolingAssetId: null }));
  });

  it('sends no run time when the field was not touched, so the derived time stands', () => {
    const { view, runs } = setup({ jobId: 7, partId: 3, defaultTargetQuantity: null, run: RUN });
    view.form.patchValue({ completedQuantity: 1940, scrapQuantity: 60 });

    view.save();

    expect(runs.updateRun).toHaveBeenCalledWith(7, 11, expect.objectContaining({
      completedQuantity: 1940, scrapQuantity: 60, status: 'InProgress', runTimeMinutes: null,
    }));
  });

  it('sends an entered run time, and 0 when the user clears it', () => {
    const entered = setup({ jobId: 7, partId: 3, defaultTargetQuantity: null, run: RUN });
    entered.view.form.controls.runTimeMinutes.setValue(42);
    entered.view.form.controls.runTimeMinutes.markAsDirty();
    entered.view.save();
    expect(entered.runs.updateRun).toHaveBeenCalledWith(7, 11, expect.objectContaining({ runTimeMinutes: 42 }));

    const cleared = setup({ jobId: 7, partId: 3, defaultTargetQuantity: null, run: RUN });
    cleared.view.form.controls.runTimeMinutes.setValue(null);
    cleared.view.form.controls.runTimeMinutes.markAsDirty();
    cleared.view.save();
    expect(cleared.runs.updateRun).toHaveBeenCalledWith(7, 11, expect.objectContaining({ runTimeMinutes: 0 }));
  });

  it('offers no tooling-clearing option on a run that already has tooling, and keeps a retired current tool listed', () => {
    const { view, assets } = setup({ jobId: 7, partId: 3, defaultTargetQuantity: null, run: RUN });
    assets.getAssets.mockReturnValue(of([{ id: 9, name: 'Mold A', cavityCount: 4, status: 'Retired' }]));
    view.ngOnInit();

    expect(view.toolingOptions().map(o => o.value)).toEqual([9]);
  });

  it('offers the default tooling option on a new run', () => {
    const { view } = setup({ jobId: 7, partId: 3, defaultTargetQuantity: 10, run: null });

    expect(view.toolingOptions().map(o => o.value)).toEqual([null, 9]);
  });

  it('refuses a target below one', () => {
    const { view, runs } = setup({ jobId: 7, partId: 3, defaultTargetQuantity: 0, run: null });

    view.save();

    expect(view.form.invalid).toBe(true);
    expect(runs.createRun).not.toHaveBeenCalled();
  });
});
