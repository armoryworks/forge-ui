import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { AvatarComponent } from '../avatar/avatar.component';
import { MentionHighlightPipe } from '../../pipes/mention-highlight.pipe';
import { formatDate } from '../../utils/date.utils';
import { ActivityItem } from '../../models/activity.model';

export interface DisplayActivity {
  id: number;
  description: string;
  createdAt: Date;
  userInitials?: string;
  userColor?: string;
  action?: string;
  batchedItems?: ActivityItem[];
}

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [AvatarComponent, MentionHighlightPipe],
  templateUrl: './activity-timeline.component.html',
  styleUrl: './activity-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityTimelineComponent {
  readonly activities = input.required<ActivityItem[]>();
  readonly compact = input(false);
  readonly filterable = input(false);

  protected readonly selectedAction = signal<string | null>(null);
  protected readonly selectedUser = signal<string | null>(null);
  protected readonly expandedBatch = signal<number | null>(null);

  protected readonly actionOptions = computed(() => {
    const actions = [...new Set(this.activities().map(a => a.action).filter(Boolean) as string[])].sort();
    return actions;
  });

  protected readonly userOptions = computed(() => {
    const users = [...new Set(
      this.activities()
        .filter(a => a.userInitials)
        .map(a => a.userInitials!),
    )].sort();
    return users;
  });

  protected readonly filteredActivities = computed(() => {
    let items = this.activities();
    const action = this.selectedAction();
    if (action) {
      items = items.filter(a => a.action === action);
    }
    const user = this.selectedUser();
    if (user) {
      items = items.filter(a => a.userInitials === user);
    }
    return items;
  });

  protected readonly displayActivities = computed<DisplayActivity[]>(() => {
    const items = this.filteredActivities();
    const result: DisplayActivity[] = [];

    for (let i = 0; i < items.length; i++) {
      const current = items[i];

      if (current.action !== 'FieldChanged') {
        result.push(current);
        continue;
      }

      const batch: ActivityItem[] = [current];
      while (i + 1 < items.length) {
        const next = items[i + 1];
        if (
          next.action === 'FieldChanged' &&
          next.userInitials === current.userInitials &&
          Math.abs(next.createdAt.getTime() - current.createdAt.getTime()) < 5000
        ) {
          batch.push(next);
          i++;
        } else {
          break;
        }
      }

      if (batch.length === 1) {
        result.push(current);
      } else {
        result.push({
          id: current.id,
          description: `Updated ${batch.length} fields`,
          createdAt: current.createdAt,
          userInitials: current.userInitials,
          userColor: current.userColor,
          action: 'FieldChanged',
          batchedItems: batch,
        });
      }
    }

    return result;
  });

  protected toggleBatch(id: number): void {
    this.expandedBatch.set(this.expandedBatch() === id ? null : id);
  }

  protected onActionFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedAction.set(value || null);
  }

  protected onUserFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedUser.set(value || null);
  }

  protected formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return formatDate(date);
  }
}
