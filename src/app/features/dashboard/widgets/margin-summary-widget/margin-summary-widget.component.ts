import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

import { environment } from '../../../../../environments/environment';

interface MarginSummary {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  averageMarginPercentage: number;
  jobCount: number;
  costedJobCount: number;
}

@Component({
  selector: 'app-margin-summary-widget',
  standalone: true,
  imports: [CurrencyPipe, TranslatePipe, EmptyStateComponent],
  templateUrl: './margin-summary-widget.component.html',
  styleUrl: './margin-summary-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarginSummaryWidgetComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly summary = signal<MarginSummary>({
    totalRevenue: 0,
    totalCost: 0,
    totalMargin: 0,
    averageMarginPercentage: 0,
    jobCount: 0,
    costedJobCount: 0,
  });

  protected readonly loadError = signal(false);

  protected readonly uncostedJobCount = computed(() => {
    const s = this.summary();
    return Math.max(s.jobCount - (s.costedJobCount ?? 0), 0);
  });

  protected readonly costMissing = computed(() => {
    const s = this.summary();
    return s.jobCount > 0 && (s.costedJobCount ?? 0) === 0;
  });

  protected readonly partialCoverage = computed(() => {
    const s = this.summary();
    const costed = s.costedJobCount ?? 0;
    return costed > 0 && costed < s.jobCount;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loadError.set(false);
    this.http.get<MarginSummary>(`${environment.apiUrl}/dashboard/margin-summary`)
      .subscribe({
        next: data => this.summary.set(data),
        error: () => this.loadError.set(true),
      });
  }
}
