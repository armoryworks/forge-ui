import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ActivityItem } from '../../models/activity.model';
import { EntityActivityService } from '../../services/entity-activity.service';
import { AvatarComponent } from '../avatar/avatar.component';

/**
 * Wave 8 — compact "Recent Communications" widget for lead / customer
 * detail surfaces. Reads the existing entity-activity feed and filters
 * to the matcher's verbs:
 *   - communication-received / communication-sent (lead-anchored auto-log)
 *   - interaction-auto-received / interaction-auto-sent (contact-anchored
 *     auto-log; also applies on the customer surface where these are
 *     written via the indexing-points pair)
 *   - interaction-logged (manual user-entered Customer Interactions)
 *
 * Top 5 are surfaced; "View all" link is the caller's responsibility
 * (the existing entity-activity tab already renders the full feed).
 *
 * If the entity has no comm-flavoured activity yet, an empty state
 * nudges the user toward the connections setup ("Connect a mailbox to
 * start tracking..."). On the lead surface that's a meaningful CTA;
 * on the customer surface the user might already be using the manual
 * Interactions feature, so the empty state is informational only.
 */
const COMM_VERB_PREFIXES = ['communication-', 'interaction-auto-', 'interaction-logged'];

@Component({
  selector: 'app-recent-communications',
  standalone: true,
  imports: [TranslatePipe, AvatarComponent],
  templateUrl: './recent-communications.component.html',
  styleUrl: './recent-communications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentCommunicationsComponent {
  private readonly activityService = inject(EntityActivityService);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<number>();
  /** Cap on rendered entries — default 5 (compact section). */
  readonly maxItems = input(5);

  protected readonly all = signal<ActivityItem[]>([]);
  protected readonly isLoading = signal(false);

  protected readonly filtered = computed(() => {
    const items = this.all();
    const max = this.maxItems();
    return items
      .filter(a => a.action && COMM_VERB_PREFIXES.some(p => a.action!.startsWith(p)))
      .slice(0, max);
  });

  constructor() {
    effect(() => {
      const id = this.entityId();
      const type = this.entityType();
      if (!id || !type) return;
      this.isLoading.set(true);
      this.activityService.getActivity(type, id).subscribe({
        next: items => {
          this.all.set(items);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    });
  }

  /** Map an activity verb to a Material icon for the row's avatar slot. */
  protected iconFor(action: string | undefined): string {
    if (!action) return 'forum';
    if (action.includes('communication-') || action.includes('interaction-auto-')) {
      return action.includes('-sent') ? 'send' : 'inbox';
    }
    if (action === 'interaction-logged') return 'edit_note';
    return 'forum';
  }

  protected formatDate(date: Date): string {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
