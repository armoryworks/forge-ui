import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { UpperCasePipe } from '@angular/common';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { KioskSession, KioskSessionService } from '../../../../shared/services/kiosk-session.service';

@Component({
  selector: 'app-kiosk-session-bar',
  standalone: true,
  imports: [UpperCasePipe, AvatarComponent],
  templateUrl: './kiosk-session-bar.component.html',
  styleUrl: './kiosk-session-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskSessionBarComponent {
  private readonly kioskSession = inject(KioskSessionService);

  protected readonly sessions = this.kioskSession.sessions;

  readonly sessionSwitched = output<KioskSession>();

  protected switchTo(session: KioskSession): void {
    this.kioskSession.activateSession(
      session.userId,
      session.userName,
      session.userInitials,
      session.userColor,
      session.badgeId,
    );
    this.sessionSwitched.emit(session);
  }
}
