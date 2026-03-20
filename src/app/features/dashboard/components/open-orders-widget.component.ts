import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../../environments/environment';

interface OpenOrderSummary {
  totalOrders: number;
  confirmedCount: number;
  inProductionCount: number;
  partiallyShippedCount: number;
  totalValue: number;
}

@Component({
  selector: 'app-open-orders-widget',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './open-orders-widget.component.html',
  styleUrl: './open-orders-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenOrdersWidgetComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly summary = signal<OpenOrderSummary>({
    totalOrders: 0,
    confirmedCount: 0,
    inProductionCount: 0,
    partiallyShippedCount: 0,
    totalValue: 0,
  });

  ngOnInit(): void {
    this.http.get<OpenOrderSummary>(`${environment.apiUrl}/dashboard/open-orders`)
      .subscribe(data => this.summary.set(data));
  }
}
