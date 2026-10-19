import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { SchedulingService } from '../scheduling/services/scheduling.service';
import { AssetsComponent } from './assets.component';
import { AssetItem } from './models/asset-item.model';
import { AssetsService } from './services/assets.service';

interface AssetsHarness {
  searchControl: FormControl<string | null>;
  typeFilterControl: FormControl<string | null>;
  statusFilterControl: FormControl<string | null>;
  assetForm: FormGroup;
  dialogRef: { clearDraft(): void };
  applyFilters(): void;
  saveAsset(): void;
  openEditAssetFromDetail(asset: AssetItem): void;
}

describe('AssetsComponent', () => {
  let assetsService: { getAssets: ReturnType<typeof vi.fn>; updateAsset: ReturnType<typeof vi.fn> };
  let afterClosed: Subject<unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    assetsService = { getAssets: vi.fn(() => of([])), updateAsset: vi.fn(() => of({})) };
    afterClosed = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        { provide: AssetsService, useValue: assetsService },
        { provide: SchedulingService, useValue: { getWorkCenters: vi.fn(() => of([])) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        {
          provide: DetailDialogService,
          useValue: { getDetailFromUrl: vi.fn(() => null), open: vi.fn(() => ({ afterClosed: () => afterClosed })) },
        },
        { provide: DraftResumeService, useValue: { consume: vi.fn(() => false) } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  function create(): AssetsHarness {
    const component = TestBed.runInInjectionContext(() => new AssetsComponent()) as unknown as AssetsHarness;
    assetsService.getAssets.mockClear();
    return component;
  }

  function calls(): unknown[][] {
    return assetsService.getAssets.mock.calls;
  }

  it('reloads with the chosen type and status', () => {
    const assets = create();

    assets.typeFilterControl.setValue('Tooling');
    assets.statusFilterControl.setValue('Retired');

    expect(calls()).toEqual([['Tooling', undefined, undefined], ['Tooling', 'Retired', undefined]]);
  });

  it('searches after the debounce, and at once on Enter', () => {
    const assets = create();

    assets.searchControl.setValue('pre');
    vi.advanceTimersByTime(100);
    assets.searchControl.setValue('press');
    vi.advanceTimersByTime(300);
    expect(calls()).toEqual([[undefined, undefined, 'press']]);

    assets.searchControl.setValue('mold');
    assets.applyFilters();
    vi.advanceTimersByTime(300);
    expect(calls()).toEqual([[undefined, undefined, 'press'], [undefined, undefined, 'mold']]);
  });

  it('edits acquisition cost, depreciation and work center, and keeps the GL account read-only', () => {
    const assets = create();
    assets.dialogRef = { clearDraft: vi.fn() };
    assets.openEditAssetFromDetail({
      id: 11, name: 'Press 1', assetType: 'Machine', status: 'Active', location: null, manufacturer: null,
      model: null, serialNumber: null, photoFileId: null, currentHours: 0, notes: null, isCustomerOwned: false,
      cavityCount: null, toolLifeExpectancy: null, currentShotCount: null, sourceJobId: null, sourceJobNumber: null,
      sourcePartId: null, sourcePartNumber: null, createdAt: new Date(), updatedAt: new Date(),
      acquisitionCost: 1501, depreciationMethod: 'StraightLine', workCenterId: 3, workCenterCode: 'WC-3', glAccount: '1500',
    });

    expect(assets.assetForm.get('glAccount')!.disabled).toBe(true);
    expect(assets.assetForm.get('acquisitionCost')!.value).toBe(1501);

    assets.assetForm.patchValue({ acquisitionCost: 1499.5, workCenterId: 4 });
    assets.saveAsset();

    const [, request] = assetsService.updateAsset.mock.calls[0];
    expect(request).toMatchObject({ acquisitionCost: 1499.5, depreciationMethod: 'StraightLine', workCenterId: 4 });
    expect(request).not.toHaveProperty('glAccount');
  });

  it('rejects an acquisition cost with a third decimal place', () => {
    const assets = create();
    const cost = assets.assetForm.get('acquisitionCost')!;

    cost.setValue(1500.999);

    expect(cost.hasError('maxDecimals')).toBe(true);
  });
});
