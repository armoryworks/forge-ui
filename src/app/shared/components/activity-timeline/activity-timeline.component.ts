import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AvatarComponent } from '../avatar/avatar.component';
import { RichTextPipe } from '../../pipes/rich-text.pipe';
import { DATETIME_FORMAT, formatDate } from '../../utils/date.utils';
import { ActivityItem } from '../../models/activity.model';
import { DisplayActivity } from '../../models/display-activity.model';
import { collapseFieldChanges } from '../../utils/activity-batching';

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [DatePipe, MatTooltipModule, TranslatePipe, AvatarComponent, RichTextPipe],
  templateUrl: './activity-timeline.component.html',
  styleUrl: './activity-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityTimelineComponent {
  private readonly translate = inject(TranslateService);

  readonly activities = input.required<ActivityItem[]>();
  readonly compact = input(false);
  readonly filterable = input(false);

  protected readonly dateTimeFormat = DATETIME_FORMAT;

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

  protected readonly displayActivities = computed<DisplayActivity[]>(() =>
    collapseFieldChanges(
      this.filteredActivities(),
      count => this.translate.instant('activityHistory.updatedFields', { count }),
    ));

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
