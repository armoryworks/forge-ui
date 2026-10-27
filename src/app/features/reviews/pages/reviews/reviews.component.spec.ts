import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { ReviewsService } from '../../services/reviews.service';
import { ReviewsComponent } from './reviews.component';

interface ReviewsView {
  tabs(): string[];
  mine(): unknown[];
  team(): unknown[];
  switchTab(tab: string): void;
  openReview(review: { id: number }): void;
}

function setup(tab: string, roles: string[]) {
  const service = {
    getMine: vi.fn(() => of([{ id: 1, status: 'NotStarted' }])),
    getTeam: vi.fn(() => of([{ id: 2, status: 'SelfSubmitted' }])),
  };
  const navigate = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab })) } },
      { provide: Router, useValue: { navigate } },
      { provide: ReviewsService, useValue: service },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new ReviewsComponent()) as unknown as ReviewsView;
  TestBed.flushEffects();
  return { view, service, navigate };
}

describe('ReviewsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows an employee only their own reviews', () => {
    const { view, service } = setup('mine', ['ProductionWorker']);
    expect(view.tabs()).toEqual(['mine']);
    expect(service.getMine).toHaveBeenCalled();
    expect(view.mine()).toHaveLength(1);
  });

  it('gives Admins and Managers the team and cycle tabs', () => {
    expect(setup('mine', ['Manager']).view.tabs()).toEqual(['mine', 'team', 'cycles']);
  });

  it('loads the reviews a manager writes on the team tab', () => {
    const { view, service } = setup('team', ['Manager']);
    expect(service.getTeam).toHaveBeenCalled();
    expect(view.team()).toHaveLength(1);
  });

  it('does not ask for team reviews for a worker', () => {
    const { service } = setup('team', ['ProductionWorker']);
    expect(service.getTeam).not.toHaveBeenCalled();
  });

  it('opens a review on its own page', () => {
    const { view, navigate } = setup('mine', ['Engineer']);
    view.openReview({ id: 9 });
    expect(navigate).toHaveBeenCalledWith(['/reviews', 'review', 9]);
  });
});
