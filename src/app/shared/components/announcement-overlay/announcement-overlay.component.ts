import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';

import { AnnouncementService } from '../../services/announcement.service';
import { Announcement } from '../../models/announcement.model';

@Component({
  selector: 'app-announcement-overlay',
  standalone: true,
  templateUrl: './announcement-overlay.component.html',
  styleUrl: './announcement-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementOverlayComponent {
  private readonly announcementService = inject(AnnouncementService);

  protected readonly visibleAnnouncements = computed(() => {
    return this.announcementService.activeAnnouncements()
      .filter(a => !a.isAcknowledgedByCurrentUser)
      .filter(a => a.severity === 'Critical' || a.severity === 'Warning' || a.requiresAcknowledgment)
      .slice(0, 3);
  });

  protected acknowledge(announcement: Announcement): void {
    this.announcementService.acknowledge(announcement.id).subscribe(() => {
      this.announcementService.markAcknowledged(announcement.id);
    });
  }

  protected dismiss(announcement: Announcement): void {
    this.announcementService.markAcknowledged(announcement.id);
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
