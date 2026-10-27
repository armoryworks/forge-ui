import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ReviewsService } from '../../services/reviews.service';
import { PerformanceReview } from '../../models/performance-review.model';
import { ReviewDetailComponent } from './review-detail.component';

interface DetailView {
  load(id: number): void;
  canSelfSubmit(): boolean;
  canManagerSubmit(): boolean;
  canAcknowledge(): boolean;
  canClose(): boolean;
  selfRatings: { controls: Record<string, { setValue(v: number): void }> };
  selfForm: { patchValue(v: unknown): void };
  managerForm: { patchValue(v: unknown): void };
  managerRatingRows(): unknown[];
  submitSelf(): void;
  submitManager(): void;
  acknowledge(): void;
}

function review(status: PerformanceReview['status'], extra: Partial<PerformanceReview> = {}): PerformanceReview {
  return {
    id: 4, cycleId: 1, cycleName: '2026', employeeId: 10, employeeName: 'Lee, Ann', reviewerId: 20, reviewerName: 'Ray, Mo',
    status, overallRating: null, goalsJson: null, competenciesJson: null, strengthsComments: null, improvementComments: null,
    employeeSelfAssessment: null, completedAt: null, acknowledgedAt: null, selfRatingsJson: null, selfSubmittedAt: null,
    managerSubmittedAt: null, acknowledgementComments: null, ratingScaleMax: 5, cycleCompetencies: ['Quality', 'Safety'], ...extra,
  };
}

function setup(r: PerformanceReview, me: number, roles: string[] = []) {
  const service = {
    getReview: vi.fn(() => of({ review: r, history: [] })),
    submitSelf: vi.fn(() => of(r)),
    submitManager: vi.fn(() => of(r)),
    acknowledge: vi.fn(() => of(r)),
    close: vi.fn(() => of(r)),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '4' })), snapshot: { paramMap: convertToParamMap({ id: '4' }) } } },
      { provide: ReviewsService, useValue: service },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: AuthService, useValue: { user: () => ({ id: me }), hasAnyRole: (wanted: string[]) => wanted.some(x => roles.includes(x)) } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new ReviewDetailComponent()) as unknown as DetailView;
  view.load(4);
  return { view, service };
}

describe('ReviewDetailComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lets the employee submit the self-review with a rating per competency', () => {
    const { view, service } = setup(review('NotStarted'), 10);
    expect(view.canSelfSubmit()).toBe(true);
    expect(view.canManagerSubmit()).toBe(false);

    view.selfRatings.controls['Quality'].setValue(4);
    view.selfForm.patchValue({ assessment: ' Strong year ' });
    view.submitSelf();

    expect(service.submitSelf).toHaveBeenCalledWith(4, {
      ratings: [{ competency: 'Quality', rating: 4, comment: null }, { competency: 'Safety', rating: null, comment: null }],
      selfAssessment: 'Strong year',
    });
  });

  it('lets the reviewer submit once the self-review is in', () => {
    const { view, service } = setup(review('SelfSubmitted'), 20, ['Manager']);
    expect(view.canManagerSubmit()).toBe(true);
    expect(view.canSelfSubmit()).toBe(false);

    view.managerForm.patchValue({ overall: 4, goals: 'Lead the cell', strengths: '', improvements: '' });
    view.submitManager();

    expect(service.submitManager).toHaveBeenCalledWith(4, expect.objectContaining({ overallRating: 4, goals: 'Lead the cell', strengthsComments: null }));
  });

  it('gives a colleague no action on someone else\'s review', () => {
    const { view } = setup(review('SelfSubmitted'), 99, ['ProductionWorker']);
    expect(view.canSelfSubmit()).toBe(false);
    expect(view.canManagerSubmit()).toBe(false);
    expect(view.canAcknowledge()).toBe(false);
    expect(view.canClose()).toBe(false);
  });

  it('asks the employee to acknowledge a submitted manager review and shows its ratings', () => {
    const { view, service } = setup(review('ManagerSubmitted', {
      overallRating: 4, competenciesJson: JSON.stringify([{ competency: 'Quality', rating: 5, comment: null }]),
    }), 10);
    expect(view.canAcknowledge()).toBe(true);
    expect(view.managerRatingRows()).toHaveLength(1);
    view.acknowledge();
    expect(service.acknowledge).toHaveBeenCalledWith(4, null);
  });

  it('lets the reviewer close an acknowledged review and an admin close earlier', () => {
    expect(setup(review('Acknowledged'), 20, ['Manager']).view.canClose()).toBe(true);
    expect(setup(review('SelfSubmitted'), 20, ['Manager']).view.canClose()).toBe(false);
    expect(setup(review('SelfSubmitted'), 1, ['Admin']).view.canClose()).toBe(true);
  });
});
