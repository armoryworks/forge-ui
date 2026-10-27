import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, Observable } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { AuthService } from '../../../../shared/services/auth.service';

import { ReviewsService } from '../../services/reviews.service';
import { PerformanceReview } from '../../models/performance-review.model';
import { REVIEW_SUPERVISOR_ROLES, ReviewTab } from '../../models/review-tab.model';
import { ReviewListComponent } from '../../components/review-list/review-list.component';
import { ReviewCyclesPanelComponent } from '../../components/review-cycles-panel/review-cycles-panel.component';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, LoadingBlockDirective, ReviewListComponent, ReviewCyclesPanelComponent],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reviews = inject(ReviewsService);
  private readonly auth = inject(AuthService);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') ?? 'mine') as ReviewTab)),
    { initialValue: 'mine' as ReviewTab },
  );

  protected readonly isSupervisor = computed(() => this.auth.hasAnyRole([...REVIEW_SUPERVISOR_ROLES]));
  protected readonly tabs = computed<ReviewTab[]>(() => this.isSupervisor() ? ['mine', 'team', 'cycles'] : ['mine']);

  protected readonly loading = signal(false);
  protected readonly mine = signal<PerformanceReview[]>([]);
  protected readonly team = signal<PerformanceReview[]>([]);

  constructor() {
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'mine') this.load(this.reviews.getMine(), this.mine);
      if (tab === 'team' && this.isSupervisor()) this.load(this.reviews.getTeam(), this.team);
    });
  }

  private load(source: Observable<PerformanceReview[]>, target: WritableSignal<PerformanceReview[]>): void {
    this.loading.set(true);
    source.subscribe({
      next: rows => {
        target.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected switchTab(tab: ReviewTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected openReview(review: PerformanceReview): void {
    this.router.navigate(['/reviews', 'review', review.id]);
  }
}
