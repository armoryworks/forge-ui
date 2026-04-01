import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../../../environments/environment';
import { ActivityTimelineComponent } from '../../../../../shared/components/activity-timeline/activity-timeline.component';
import { ActivityItem } from '../../../../../shared/models/activity.model';

@Component({
  selector: 'app-customer-activity-tab',
  standalone: true,
  imports: [ActivityTimelineComponent],
  templateUrl: './customer-activity-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActivityTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly customerId = input.required<number>();

  protected readonly activities = signal<ActivityItem[]>([]);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<ActivityItem[]>(`${environment.apiUrl}/customers/${this.customerId()}/activity`).subscribe({
      next: data => { this.activities.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
