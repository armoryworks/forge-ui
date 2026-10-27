import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DetailLoadErrorComponent } from '../../../../shared/components/detail-load-error/detail-load-error.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { parsePositiveId } from '../../../../shared/utils/parse-positive-id';
import { notFoundError } from '../../../../shared/utils/not-found-error';

import { ReviewsService } from '../../services/reviews.service';
import { PerformanceReview } from '../../models/performance-review.model';
import { ReviewHistoryItem } from '../../models/review-history-item.model';
import { ReviewCompetencyRating } from '../../models/review-competency-rating.model';
import { reviewStage, reviewStageRank } from '../../models/review-stage.util';

function parseRatings(json: string | null): ReviewCompetencyRating[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed as ReviewCompetencyRating[] : [];
  } catch {
    return [];
  }
}

function parseGoals(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.map(g => String(g)) : [String(parsed)];
  } catch {
    return [json];
  }
}

@Component({
  selector: 'app-review-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, TranslatePipe, DateTimePipe,
    SelectComponent, TextareaComponent, DetailLoadErrorComponent, LoadingBlockDirective,
  ],
  templateUrl: './review-detail.component.html',
  styleUrl: './review-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly reviews = inject(ReviewsService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly reviewId = toSignal(
    this.route.paramMap.pipe(map(p => parsePositiveId(p.get('id')))),
    { initialValue: parsePositiveId(this.route.snapshot?.paramMap.get('id') ?? null) },
  );

  protected readonly review = signal<PerformanceReview | null>(null);
  protected readonly history = signal<ReviewHistoryItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<unknown>(null);
  protected readonly saving = signal(false);

  protected readonly selfRatings = new FormRecord<FormControl<number | null>>({});
  protected readonly managerRatings = new FormRecord<FormControl<number | null>>({});
  protected readonly selfForm = new FormGroup({
    assessment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
  });
  protected readonly managerForm = new FormGroup({
    overall: new FormControl<number | null>(null, { validators: [Validators.required] }),
    goals: new FormControl('', { nonNullable: true }),
    strengths: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
    improvements: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
  });
  protected readonly ackForm = new FormGroup({
    comments: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  private readonly me = computed(() => this.auth.user()?.id ?? 0);
  protected readonly isAdmin = computed(() => this.auth.hasAnyRole(['Admin']));
  protected readonly isSubject = computed(() => this.review()?.employeeId === this.me());
  protected readonly isReviewer = computed(() => this.review()?.reviewerId === this.me() && !this.isSubject());
  protected readonly rank = computed(() => {
    const r = this.review();
    return r ? reviewStageRank(r.status) : 0;
  });
  protected readonly stage = computed(() => {
    const r = this.review();
    return r ? reviewStage(r.status) : 'notStarted';
  });

  protected readonly competencies = computed(() => this.review()?.cycleCompetencies ?? []);
  protected readonly scaleOptions = computed<SelectOption[]>(() => {
    const max = this.review()?.ratingScaleMax ?? 5;
    return Array.from({ length: max }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  });

  protected readonly canSelfSubmit = computed(() => this.isSubject() && this.rank() === 0);
  protected readonly canManagerSubmit = computed(() => !this.isSubject() && (this.isReviewer() || this.isAdmin()) && this.rank() === 1);
  protected readonly canAcknowledge = computed(() => this.isSubject() && this.rank() === 2);
  protected readonly canClose = computed(() => !this.isSubject()
    && ((this.isReviewer() && this.rank() === 3) || (this.isAdmin() && this.rank() < 4)));

  protected readonly selfRatingRows = computed(() => parseRatings(this.review()?.selfRatingsJson ?? null));
  protected readonly managerRatingRows = computed(() => parseRatings(this.review()?.competenciesJson ?? null));
  protected readonly goals = computed(() => parseGoals(this.review()?.goalsJson ?? null));

  constructor() {
    effect(() => {
      const id = this.reviewId();
      if (id) {
        this.load(id);
      } else {
        this.loading.set(false);
        this.loadError.set(notFoundError());
      }
    });
  }

  protected load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.reviews.getReview(id).subscribe({
      next: detail => {
        this.applyReview(detail.review);
        this.history.set(detail.history);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(err);
        this.loading.set(false);
      },
    });
  }

  protected reload(): void {
    const id = this.reviewId();
    if (id) this.load(id);
  }

  private applyReview(review: PerformanceReview): void {
    this.review.set(review);
    const names = review.cycleCompetencies ?? [];
    const self = new Map(parseRatings(review.selfRatingsJson).map(r => [r.competency, r.rating]));
    const manager = new Map(parseRatings(review.competenciesJson).map(r => [r.competency, r.rating]));
    for (const key of Object.keys(this.selfRatings.controls)) this.selfRatings.removeControl(key);
    for (const key of Object.keys(this.managerRatings.controls)) this.managerRatings.removeControl(key);
    for (const name of names) {
      this.selfRatings.addControl(name, new FormControl<number | null>(self.get(name) ?? null));
      this.managerRatings.addControl(name, new FormControl<number | null>(manager.get(name) ?? null));
    }
    this.selfForm.patchValue({ assessment: review.employeeSelfAssessment ?? '' });
    this.managerForm.patchValue({
      overall: review.overallRating,
      goals: parseGoals(review.goalsJson).join('\n'),
      strengths: review.strengthsComments ?? '',
      improvements: review.improvementComments ?? '',
    });
  }

  private ratingsFrom(record: FormRecord<FormControl<number | null>>): ReviewCompetencyRating[] {
    return Object.entries(record.getRawValue()).map(([competency, rating]) => ({ competency, rating, comment: null }));
  }

  protected submitSelf(): void {
    const r = this.review();
    if (!r || this.saving()) return;
    this.run(this.reviews.submitSelf(r.id, {
      ratings: this.ratingsFrom(this.selfRatings),
      selfAssessment: this.selfForm.controls.assessment.value.trim() || null,
    }), 'reviews.detail.selfSubmitted');
  }

  protected submitManager(): void {
    const r = this.review();
    const overall = this.managerForm.controls.overall.value;
    if (!r || overall === null || this.saving()) return;
    const v = this.managerForm.getRawValue();
    this.run(this.reviews.submitManager(r.id, {
      ratings: this.ratingsFrom(this.managerRatings),
      overallRating: overall,
      goals: v.goals.trim() || null,
      strengthsComments: v.strengths.trim() || null,
      improvementComments: v.improvements.trim() || null,
    }), 'reviews.detail.managerSubmitted');
  }

  protected acknowledge(): void {
    const r = this.review();
    if (!r || this.saving()) return;
    this.run(this.reviews.acknowledge(r.id, this.ackForm.controls.comments.value.trim() || null), 'reviews.detail.acknowledged');
  }

  protected closeReview(): void {
    const r = this.review();
    if (!r || this.saving()) return;
    this.run(this.reviews.close(r.id), 'reviews.detail.closed');
  }

  private run(call: ReturnType<ReviewsService['close']>, successKey: string): void {
    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(successKey));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'reviews.detail.actionFailed');
      },
    });
  }
}
