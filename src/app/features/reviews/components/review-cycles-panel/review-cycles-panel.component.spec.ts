import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';

import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ReviewsService } from '../../services/reviews.service';
import { ReviewCycle } from '../../models/review-cycle.model';
import { ReviewCyclesPanelComponent } from './review-cycles-panel.component';

interface PanelView {
  canManage(): boolean;
  cycles(): ReviewCycle[];
  cycleReviews(): unknown[];
  select(row: unknown): void;
  launch(cycle: ReviewCycle): void;
  close(cycle: ReviewCycle): void;
  openDialog(cycle: ReviewCycle | null): void;
}

const draft = { id: 3, name: '2026 annual', status: 'Draft', reviewCount: 0 } as ReviewCycle;

function setup(roles: string[], confirmed = true) {
  const service = {
    getCycles: vi.fn(() => of([draft])),
    getCycleReviews: vi.fn(() => of([{ id: 11 }])),
    launchCycle: vi.fn(() => of({ cycleId: 3, reviewsCreated: 4, alreadyReviewed: 0 })),
    closeCycle: vi.fn(() => of(undefined)),
  };
  const open = vi.fn(() => ({ afterClosed: () => of(confirmed) }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: ReviewsService, useValue: service },
      { provide: MatDialog, useValue: { open } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new ReviewCyclesPanelComponent()) as unknown as PanelView;
  return { view, service, open };
}

describe('ReviewCyclesPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the cycles and lets only an Admin manage them', () => {
    const admin = setup(['Admin']);
    expect(admin.service.getCycles).toHaveBeenCalled();
    expect(admin.view.cycles()).toEqual([draft]);
    expect(admin.view.canManage()).toBe(true);
    expect(setup(['Manager']).view.canManage()).toBe(false);
  });

  it('shows the reviews of the selected cycle', () => {
    const { view, service } = setup(['Manager']);
    view.select(draft);
    expect(service.getCycleReviews).toHaveBeenCalledWith(3);
    expect(view.cycleReviews()).toHaveLength(1);
  });

  it('launches a cycle after confirmation and reloads', () => {
    const { view, service } = setup(['Admin']);
    view.launch(draft);
    expect(service.launchCycle).toHaveBeenCalledWith(3);
    expect(service.getCycles).toHaveBeenCalledTimes(2);
  });

  it('does not close a cycle when the confirmation is declined', () => {
    const { view, service } = setup(['Admin'], false);
    view.close({ ...draft, status: 'Active' });
    expect(service.closeCycle).not.toHaveBeenCalled();
  });
});
