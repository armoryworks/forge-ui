import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VendorCreditsPanelComponent } from './vendor-credits-panel.component';
import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorCreditMemoListItem } from '../../models/vendor-credit-memo-list-item.model';
import { DetailDialogService } from '../../../../shared/services/detail-dialog.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface PanelInternals {
  memos(): VendorCreditMemoListItem[];
  canManage: boolean;
  filters: { patchValue(v: Record<string, unknown>): void };
  openDetail(id: number): void;
  onCreated(id: number): void;
}

describe('VendorCreditsPanelComponent', () => {
  let getMemos: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  const build = (roles: string[], detail: { entityType: string; entityId: number } | null = null): PanelInternals => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorCreditMemoService, useValue: { getMemos } },
        { provide: DetailDialogService, useValue: { getDetailFromUrl: () => detail, open } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new VendorCreditsPanelComponent()) as unknown as PanelInternals;
  };

  beforeEach(() => {
    getMemos = vi.fn(() => of([{ id: 4, memoNumber: 'VCM-000004' }]));
    open = vi.fn(() => ({ afterClosed: () => of(true) }));
  });

  it('lists memos and reloads when the filters change', () => {
    const panel = build(['OfficeManager']);
    expect(panel.memos().length).toBe(1);
    expect(panel.canManage).toBe(true);

    panel.filters.patchValue({ vendorId: 2 });
    expect(getMemos).toHaveBeenLastCalledWith({ vendorId: 2, status: null });
  });

  it('hides the new-memo action from read-only roles', () => {
    expect(build(['Procurement']).canManage).toBe(false);
    expect(build(['Controller']).canManage).toBe(false);
  });

  it('opens a memo named in the URL and reloads after it changed', () => {
    build(['OfficeManager'], { entityType: 'vendor-credit-memo', entityId: 4 });
    expect(open).toHaveBeenCalledWith('vendor-credit-memo', 4, expect.anything(), { memoId: 4 }, { width: '800px' });
    expect(getMemos).toHaveBeenCalledTimes(2);
  });
});
