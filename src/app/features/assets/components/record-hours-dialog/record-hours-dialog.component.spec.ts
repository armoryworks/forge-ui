import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AssetItem } from '../../models/asset-item.model';
import { AssetsService } from '../../services/assets.service';
import { RecordHoursDialogComponent } from './record-hours-dialog.component';

const PRESS = { id: 5, name: 'Press 1', currentHours: 1200 } as AssetItem;

function setup() {
  const assets = { updateMachineHours: vi.fn(() => of({ ...PRESS, currentHours: 1250 })) };
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: MAT_DIALOG_DATA, useValue: { asset: PRESS } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: AssetsService, useValue: assets },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new RecordHoursDialogComponent());
  return { view, assets, close };
}

describe('RecordHoursDialogComponent', () => {
  it('records a reading at or above the last one with its date', () => {
    const { view, assets, close } = setup();
    view.form.patchValue({ currentHours: 1250, readingAt: new Date(2026, 9, 25) });

    view.save();

    expect(assets.updateMachineHours).toHaveBeenCalledWith(5, 1250, '2026-10-25T00:00:00Z');
    expect(close).toHaveBeenCalled();
  });

  it('refuses a reading below the last recorded one', () => {
    const { view, assets } = setup();
    view.form.patchValue({ currentHours: 1100 });

    view.save();

    expect(view.form.controls.currentHours.invalid).toBe(true);
    expect(assets.updateMachineHours).not.toHaveBeenCalled();
  });
});
