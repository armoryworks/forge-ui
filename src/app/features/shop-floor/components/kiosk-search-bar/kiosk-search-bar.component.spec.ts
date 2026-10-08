import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { KioskSearchBarComponent } from './kiosk-search-bar.component';
import { ShopFloorService } from '../../services/shop-floor.service';
import { SearchResult } from '../../../../shared/models/search.model';
import { JobStatus } from '../../../../shared/models/mobile-api.model';

const jobResult: SearchResult = {
  entityType: 'Job', entityId: 42, title: 'J-2403', subtitle: 'Bracket run', icon: 'work', url: '/kanban',
};
const partResult: SearchResult = {
  entityType: 'Part', entityId: 7, title: 'P-100', subtitle: 'Bracket', icon: 'inventory_2', url: '/parts',
};
const status: JobStatus = {
  id: 42, jobNumber: 'J-2403', title: 'Bracket run', customerName: null, stageId: 3, stageName: 'Machining',
  stageColor: '#123456', dueDate: '2026-10-20T00:00:00Z', isOverdue: false, nextStageId: null, nextStageName: null,
  previousStageId: null, previousStageName: null, rowVersion: 1, recentActivity: [],
};

describe('KioskSearchBarComponent', () => {
  const router = { navigateByUrl: vi.fn(), navigate: vi.fn() };
  const shopFloor = { getJobStatus: vi.fn<ShopFloorService['getJobStatus']>() };

  function create() {
    const fixture = TestBed.createComponent(KioskSearchBarComponent);
    fixture.detectChanges();
    const select = (r: SearchResult) => {
      (fixture.componentInstance as unknown as { select(r: SearchResult): void }).select(r);
      fixture.detectChanges();
    };
    const query = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
    return { fixture, select, query };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    shopFloor.getJobStatus.mockReturnValue(of(status));
    TestBed.configureTestingModule({
      imports: [KioskSearchBarComponent, TranslateModule.forRoot()],
      providers: [
        { provide: HttpClient, useValue: { get: vi.fn(() => of([])) } },
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: Router, useValue: router },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('opens a job card in place instead of leaving the kiosk', () => {
    const { select, query } = create();

    select(jobResult);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(shopFloor.getJobStatus).toHaveBeenCalledWith(42);
    expect(query('kiosk-search-card')?.textContent).toContain('J-2403');
    expect(query('kiosk-search-card')?.textContent).toContain('Bracket run');
    expect(query('kiosk-search-card-status')?.textContent).toContain('Machining');
    expect(query('kiosk-search-card-due')?.textContent).toContain('2026');
    expect(query('kiosk-search-card-hint')).not.toBeNull();
  });

  it('shows only the label for a result that is not a job', () => {
    const { select, query } = create();

    select(partResult);

    expect(shopFloor.getJobStatus).not.toHaveBeenCalled();
    expect(query('kiosk-search-card')?.textContent).toContain('P-100');
    expect(query('kiosk-search-card-status')).toBeNull();
    expect(query('kiosk-search-card-hint')).toBeNull();
  });

  it('still shows the job card when its status cannot be loaded', () => {
    shopFloor.getJobStatus.mockReturnValue(throwError(() => new Error('boom')));
    const { select, query } = create();

    select(jobResult);

    expect(query('kiosk-search-card')?.textContent).toContain('J-2403');
    expect(query('kiosk-search-card')?.textContent).toContain('kioskSetup.searchCard.loadFailed');
  });

  it('closes the card', () => {
    const { fixture, select, query } = create();
    select(jobResult);

    query('kiosk-search-card-close')?.click();
    fixture.detectChanges();

    expect(query('kiosk-search-card')).toBeNull();
  });

  it('closes the card when a new search is typed', () => {
    const { fixture, select, query } = create();
    select(jobResult);
    const input = query('kiosk-search-input') as HTMLInputElement;

    input.value = 'J';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(query('kiosk-search-card')).toBeNull();
  });

  it('closes the card when the search box gets focus', () => {
    const { fixture, select, query } = create();
    select(jobResult);

    query('kiosk-search-input')?.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(query('kiosk-search-card')).toBeNull();
  });
});
