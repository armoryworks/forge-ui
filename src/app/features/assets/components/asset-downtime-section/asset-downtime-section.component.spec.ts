import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AssetItem } from '../../models/asset-item.model';
import { DowntimeLog } from '../../models/downtime-log.model';
import { AssetsService } from '../../services/assets.service';
import { AssetDowntimeSectionComponent } from './asset-downtime-section.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const PRESS = { id: 5, name: 'Press 1' } as AssetItem;
const OPEN = {
  id: 21, assetId: 5, assetName: 'Press 1', workCenterId: 4, reportedById: 1, startedAt: new Date('2026-10-26T10:00:00Z'),
  endedAt: null, category: 'EquipmentFailure', reason: 'Hydraulic leak', resolution: null, isPlanned: false, notes: null,
  durationHours: 1, createdAt: new Date('2026-10-26T10:00:00Z'),
} as DowntimeLog;

function setup(capability = true, roles = true, logs: DowntimeLog[] = [OPEN]) {
  const assets = { getDowntimeLogs: vi.fn(() => of(logs)), endDowntimeLog: vi.fn(() => of({ ...OPEN, endedAt: new Date() })) };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AssetDowntimeSectionComponent],
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: AssetsService, useValue: assets },
      { provide: AuthService, useValue: { hasAnyRole: vi.fn(() => roles) } },
      { provide: CapabilityService, useValue: { isEnabled: vi.fn((code: string) => capability && code === 'CAP-MAINT-BREAKDOWN') } },
      { provide: MatDialog, useValue: dialog },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(AssetDowntimeSectionComponent);
  fixture.componentRef.setInput('asset', PRESS);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, assets, dialog };
}

describe('AssetDowntimeSectionComponent', () => {
  it('lists the asset\'s downtime and ends an open stop', () => {
    const { el, assets } = setup();

    expect(assets.getDowntimeLogs).toHaveBeenCalledWith(5);
    expect(el.querySelector('[data-testid="asset-downtime-21"]')?.textContent).toContain('Hydraulic leak');
    expect((el.querySelector('[data-testid="asset-downtime-start"]') as HTMLButtonElement).disabled).toBe(true);
    (el.querySelector('[data-testid="asset-downtime-end-21"]') as HTMLButtonElement).click();
    expect(assets.endDowntimeLog).toHaveBeenCalledWith(21);
  });

  it('opens the downtime dialog for this asset when it is running', () => {
    const { el, dialog } = setup(true, true, []);

    expect(el.querySelector('[data-testid="asset-downtime-empty"]')).not.toBeNull();
    (el.querySelector('[data-testid="asset-downtime-start"]') as HTMLButtonElement).click();
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { asset: PRESS } }));
  });

  it('is hidden while breakdown maintenance is off or for other roles', () => {
    for (const [capability, roles] of [[false, true], [true, false]]) {
      const { el, assets } = setup(capability, roles);
      expect(el.querySelector('[data-testid="asset-downtime-section"]')).toBeNull();
      expect(assets.getDowntimeLogs).not.toHaveBeenCalled();
    }
  });
});
