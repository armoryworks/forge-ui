import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { forkJoin, of } from 'rxjs';

import { AnnouncementService } from '../../services/announcement.service';
import { Announcement } from '../../models/announcement.model';

interface AnnouncementGroup {
  representative: Announcement;
  memberIds: number[];
  count: number;
}

@Component({
  selector: 'app-announcement-overlay',
  standalone: true,
  templateUrl: './announcement-overlay.component.html',
  styleUrl: './announcement-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementOverlayComponent {
  private readonly announcementService = inject(AnnouncementService);

  protected readonly visibleAnnouncements = computed<AnnouncementGroup[]>(() => {
    const eligible = this.announcementService.activeAnnouncements()
      .filter(a => !a.isAcknowledgedByCurrentUser)
      .filter(a => a.severity === 'Critical' || a.severity === 'Warning' || a.requiresAcknowledgment);

    const groups = new Map<string, AnnouncementGroup>();
    for (const a of eligible) {
      const key = `${a.severity}|${a.title}|${a.content}|${a.requiresAcknowledgment}`;
      const existing = groups.get(key);
      if (existing) {
        existing.memberIds.push(a.id);
        existing.count++;
      } else {
        groups.set(key, { representative: a, memberIds: [a.id], count: 1 });
      }
    }
    return Array.from(groups.values()).slice(0, 3);
  });

  protected acknowledge(group: AnnouncementGroup): void {
    const calls = group.memberIds.map(id => this.announcementService.acknowledge(id));
    forkJoin(calls.length ? calls : [of(void 0)]).subscribe(() => {
      for (const id of group.memberIds) {
        this.announcementService.markAcknowledged(id);
      }
    });
  }

  protected getSeverityClass(severity: string): string {
    switch (severity) {
      case 'Critical': return 'announcement--critical';
      case 'Warning': return 'announcement--warning';
      default: return 'announcement--info';
    }
  }

  protected getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'Critical': return 'error';
      case 'Warning': return 'warning';
      default: return 'info';
    }
  }
}
