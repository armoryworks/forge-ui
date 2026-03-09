import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AvatarComponent } from '../avatar/avatar.component';
import { ActivityItem } from '../../models/activity.model';

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './activity-timeline.component.html',
  styleUrl: './activity-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityTimelineComponent {
  readonly activities = input.required<ActivityItem[]>();
  readonly compact = input(false);

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
