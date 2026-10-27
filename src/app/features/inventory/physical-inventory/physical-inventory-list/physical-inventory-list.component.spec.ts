import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { PhysicalInventoryListComponent } from './physical-inventory-list.component';
import { PhysicalInventoryService } from '../services/physical-inventory.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface ListInternals {
  inventories(): unknown[];
  canManage(): boolean;
  open(row: unknown): void;
}

describe('PhysicalInventoryListComponent', () => {
  const list = vi.fn();
  const navigate = vi.fn();
  let roles: string[];
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function create(): ListInternals {
    TestBed.configureTestingModule({
      providers: [
        { provide: PhysicalInventoryService, useValue: { list } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() => new PhysicalInventoryListComponent()) as unknown as ListInternals;
  }

  beforeEach(() => {
    list.mockReset().mockReturnValue(of([{ id: 4, inventoryNumber: 'PI-000004', status: 'Counting' }]));
    navigate.mockReset();
    roles = ['Admin'];
    params = new BehaviorSubject(convertToParamMap({}));
  });

  it('loads the counts and lets a manager start one', () => {
    const component = create();
    expect(list).toHaveBeenCalledWith(null);
    expect(component.inventories()).toHaveLength(1);
    expect(component.canManage()).toBe(true);
  });

  it('filters by the status in the URL', () => {
    params.next(convertToParamMap({ status: 'Review' }));
    create();
    expect(list).toHaveBeenCalledWith('Review');
  });

  it('hides the new button from a counter and opens a count on click', () => {
    roles = ['Engineer'];
    const component = create();
    expect(component.canManage()).toBe(false);
    component.open({ id: 4 });
    expect(navigate).toHaveBeenCalledWith(['/inventory/physical-inventory', 4]);
  });
});
