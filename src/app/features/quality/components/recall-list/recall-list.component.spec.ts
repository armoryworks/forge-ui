import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';

import { RecallListComponent } from './recall-list.component';
import { RecallService } from '../../services/recall.service';
import { Recall } from '../../models/recall.model';
import { DetailDialogService } from '../../../../shared/services/detail-dialog.service';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';

const RECALLS: Recall[] = [
  {
    id: 4, initiatedLotId: 12, initiatedLotNumber: 'LOT-12', reason: 'Contaminated resin',
    recallDate: new Date('2026-10-01'), status: 'Active', affectedLotsCount: 3, affectedShipmentsCount: 3,
    affectedCustomersCount: 2, totalQuarantinedQuantity: 30, resolvedAt: null, createdAt: new Date('2026-10-01'),
  },
  {
    id: 2, initiatedLotId: 7, initiatedLotNumber: 'LOT-7', reason: 'Out-of-spec hardness',
    recallDate: new Date('2026-08-01'), status: 'Resolved', affectedLotsCount: 1, affectedShipmentsCount: 0,
    affectedCustomersCount: 0, totalQuarantinedQuantity: 0, resolvedAt: new Date('2026-08-15'), createdAt: new Date('2026-08-01'),
  },
];

interface ListApi {
  recalls(): Recall[];
  columns: ColumnDef[];
  onRowClick(row: unknown): void;
}

describe('RecallListComponent', () => {
  let getRecalls: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let detailFromUrl: { entityType: string; entityId: number } | null;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function create() {
    getRecalls = vi.fn(() => of(RECALLS));
    open = vi.fn(() => ({ afterClosed: () => of(false) }));
    queryParams = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [RecallListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: RecallService, useValue: { getRecalls } },
        { provide: DetailDialogService, useValue: { open, getDetailFromUrl: () => detailFromUrl } },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn(), reset: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(RecallListComponent);
    fixture.detectChanges();
    return { fixture, api: fixture.componentInstance as unknown as ListApi };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    detailFromUrl = null;
  });

  it('renders a row per recall with its lot, number and status', () => {
    const { fixture, api } = create();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(getRecalls).toHaveBeenCalled();
    expect(api.recalls()).toHaveLength(2);
    expect(html).toContain('LOT-12');
    expect(html).toContain('LOT-7');
    expect(html).toContain('recalls.statusActive');
    expect(html).toContain('recalls.statusResolved');
  });

  it('shows how many distinct customers each recall reached', () => {
    const { fixture, api } = create();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(api.columns.find(c => c.field === 'affectedCustomersCount')).toEqual(expect.objectContaining({
      header: 'recalls.colCustomers', type: 'number',
    }));
    expect(html).toContain('recalls.colCustomers');
  });

  it('opens the recall detail on row click and reloads the list when it closes', () => {
    const { api } = create();

    api.onRowClick(RECALLS[0]);

    expect(open).toHaveBeenCalledWith('recall', 4, expect.anything(), { recallId: 4 });
    expect(getRecalls).toHaveBeenCalledTimes(2);
  });

  it('opens the recall named in ?detail= on load', () => {
    detailFromUrl = { entityType: 'recall', entityId: 2 };
    create();

    expect(open).toHaveBeenCalledWith('recall', 2, expect.anything(), { recallId: 2 });
  });
});
