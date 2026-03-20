import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';

interface MarginSummary {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  averageMarginPercentage: number;
  jobCount: number;
}

@Component({
  selector: 'app-margin-summary-widget',
  standalone: true,
  imports: [CurrencyPipe, TranslatePipe],
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
  });

  ngOnInit(): void {
    this.http.get<MarginSummary>(`${environment.apiUrl}/dashboard/margin-summary`)
      .subscribe(data => this.summary.set(data));
  }
}
