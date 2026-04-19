import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { KioskSessionService, KioskSession, ScanMode } from '../../../../shared/services/kiosk-session.service';

@Component({
  selector: 'app-kiosk-session-bar',
  standalone: true,
  imports: [TranslatePipe, AvatarComponent],
  templateUrl: './kiosk-session-bar.component.html',
  styleUrl: './kiosk-session-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskSessionBarComponent {
  protected readonly kioskSession = inject(KioskSessionService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sessions = this.kioskSession.sessions;
  protected readonly foregroundSession = this.kioskSession.foregroundSession;

  protected readonly hasMultipleSessions = computed(() => this.sessions().length > 1);

  private readonly tick = signal(0);

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick.update(t => t + 1));
  }

  protected isForeground(session: KioskSession): boolean {
    return session.isForeground;
  }

  protected getIdleDisplay(session: KioskSession): string {
    this.tick(); // Subscribe to tick for reactivity
    const ms = Date.now() - session.lastActivity.getTime();
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  protected getModeLabel(mode: ScanMode | null): string {
    switch (mode) {
      case 'move': return 'Moving';
      case 'count': return 'Counting';
      case 'receive': return 'Receiving';
      case 'issue': return 'Issuing';
      case 'ship': return 'Shipping';
      case 'inspect': return 'Inspecting';
      default: return 'Idle';
    }
  }

  protected getModeIcon(mode: ScanMode | null): string {
    switch (mode) {
      case 'move': return 'swap_horiz';
      case 'count': return 'inventory';
      case 'receive': return 'move_to_inbox';
      case 'issue': return 'output';
      case 'ship': return 'local_shipping';
      case 'inspect': return 'fact_check';
      default: return 'person';
    }
  }

  protected switchTo(session: KioskSession): void {
    this.kioskSession.activateSession(
      session.userId, session.userName, session.userInitials, session.userColor, session.badgeId,
    );
  }

  protected dismiss(event: Event, session: KioskSession): void {
    event.stopPropagation();
    this.kioskSession.removeSession(session.userId);
  }
}
