import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { PhysicalInventoryDetailComponent } from './physical-inventory-detail.component';
import { PhysicalInventoryService } from '../services/physical-inventory.service';
import { PhysicalInventoryDetail } from '../models/physical-inventory-detail.model';
import { PhysicalCountRow } from '../models/physical-count-row.model';
import { PhysicalInventoryTag } from '../models/physical-inventory-tag.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DetailInternals {
  inventory(): PhysicalInventoryDetail | null;
  rows(): PhysicalCountRow[];
  counting(): boolean;
  canManage(): boolean;
  canSubmitReview(): boolean;
  showBook(): boolean;
  variance(): unknown;
  saveCount(row: PhysicalCountRow): void;
  post(): void;
}

const tag = (id: number, status: string, finalQuantity: number | null): PhysicalInventoryTag => ({
  id, physicalInventoryId: 7, tagNumber: id, locationId: 1, locationName: 'Rack 1', locationBarcode: null, partId: 3,
  partNumber: 'P-3', partDescription: null, lotNumber: null, serialNumber: null, frozenQuantity: null,
  countedQuantity: finalQuantity, recountQuantity: null, finalQuantity, status: status as PhysicalInventoryTag['status'],
  countedAt: null, recountedAt: null, notes: null,
});

function detail(status: string, tags = [tag(1, 'Open', null), tag(2, 'Counted', 4)]): PhysicalInventoryDetail {
  return {
    id: 7, inventoryNumber: 'PI-000007', description: null, scopeLocationId: null, scopeLocationName: null,
    status: status as PhysicalInventoryDetail['status'], countDate: '2026-06-30', blindCount: true, recountTolerancePercent: 5,
    notes: null, frozenAt: null, postedAt: null, cancelledAt: null, totalVarianceValue: 0, tagCount: tags.length,
    countedTagCount: tags.filter(t => t.status === 'Counted').length, recountTagCount: 0,
    bookQuantitiesVisible: status === 'Review', createdAt: '', tags,
  };
}

describe('PhysicalInventoryDetailComponent', () => {
  const service = {
    get: vi.fn(), enterCount: vi.fn(), variance: vi.fn(), post: vi.fn(), freeze: vi.fn(),
    submitForReview: vi.fn(), reopen: vi.fn(), cancel: vi.fn(), countSheets: vi.fn(),
  };
  const confirm = vi.fn();
  let roles: string[];

  function create(): DetailInternals {
    TestBed.configureTestingModule({
      providers: [
        { provide: PhysicalInventoryService, useValue: service },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), warn: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key, currentLang: 'en' } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirm()) }) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new PhysicalInventoryDetailComponent()) as unknown as DetailInternals;
  }

  beforeEach(() => {
    Object.values(service).forEach(fn => fn.mockReset());
    confirm.mockReset().mockReturnValue(true);
    roles = ['Admin'];
    service.variance.mockReturnValue(of({ lines: [], shortageValue: -10, overageValue: 0, netVarianceValue: -10, tagCount: 2, varianceTagCount: 1 }));
  });

  it('loads the count and offers count entry with the book quantity hidden', () => {
    service.get.mockReturnValue(of(detail('Counting')));
    const component = create();
    expect(service.get).toHaveBeenCalledWith(7);
    expect(component.counting()).toBe(true);
    expect(component.showBook()).toBe(false);
    expect(component.rows()).toHaveLength(2);
    expect(component.canSubmitReview()).toBe(false);
  });

  it('saves a count and moves the tag to counted', () => {
    service.get.mockReturnValue(of(detail('Counting')));
    const component = create();
    const row = component.rows()[0];
    row.control.setValue(9);
    service.enterCount.mockReturnValue(of(tag(1, 'Counted', 9)));

    component.saveCount(row);

    expect(service.enterCount).toHaveBeenCalledWith(7, 1, 9);
    expect(component.inventory()?.countedTagCount).toBe(2);
    expect(component.canSubmitReview()).toBe(true);
  });

  it('shows the variance to a manager in review and posts after confirming', () => {
    service.get.mockReturnValue(of(detail('Review', [tag(1, 'Counted', 3)])));
    service.post.mockReturnValue(of(detail('Posted', [tag(1, 'Counted', 3)])));
    const component = create();
    expect(service.variance).toHaveBeenCalledWith(7);
    expect(component.variance()).not.toBeNull();

    component.post();

    expect(service.post).toHaveBeenCalledWith(7);
    expect(component.inventory()?.status).toBe('Posted');
  });

  it('keeps the variance and lifecycle actions from a counter', () => {
    roles = ['ProductionWorker'];
    service.get.mockReturnValue(of(detail('Review', [tag(1, 'Counted', 3)])));
    const component = create();
    expect(component.canManage()).toBe(false);
    expect(service.variance).not.toHaveBeenCalled();
  });
});
