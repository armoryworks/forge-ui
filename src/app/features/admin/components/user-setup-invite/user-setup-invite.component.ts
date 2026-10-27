import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { formatDateTime } from '../../../../shared/utils/date.utils';
import { AdminUser } from '../../models/admin-user.model';
import { AdminService } from '../../services/admin.service';

/**
 * Emails a user who has not finished account setup a fresh setup link, and shows when one was last sent.
 * Renders nothing for users who have set a password, service accounts and inactive users.
 */
@Component({
  selector: 'app-user-setup-invite',
  standalone: true,
  imports: [TranslatePipe, MatTooltipModule, DateTimePipe],
  templateUrl: './user-setup-invite.component.html',
  styleUrl: './user-setup-invite.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSetupInviteComponent {
  private readonly admin = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly user = input.required<AdminUser>();
  readonly compact = input(false);
  readonly sent = output<string>();

  private readonly sentNow = signal<string | null>(null);
  protected readonly sending = signal(false);

  protected readonly visible = computed(() => {
    const u = this.user();
    return !u.hasPassword && !u.isServiceAccount && u.isActive && !!u.email;
  });
  protected readonly lastSentAt = computed(() => this.sentNow() ?? this.user().lastInviteSentAt ?? null);
  protected readonly labelKey = computed(() => this.lastSentAt() ? 'admin.invite.resend' : 'admin.invite.send');
  protected readonly tooltip = computed(() => {
    const last = this.lastSentAt();
    const label = this.translate.instant(this.labelKey());
    return last ? `${label} — ${this.translate.instant('admin.invite.lastSent', { date: formatDateTime(last) })}` : label;
  });

  protected send(): void {
    if (this.sending()) return;
    const u = this.user();
    this.sending.set(true);
    this.admin.sendSetupInvite(u.id, window.location.origin).subscribe({
      next: () => {
        const now = new Date().toISOString();
        this.sending.set(false);
        this.sentNow.set(now);
        this.sent.emit(now);
        this.snackbar.success(this.translate.instant('admin.invite.sent', { email: u.email }));
      },
      error: (err: unknown) => {
        this.sending.set(false);
        this.snackbar.errorFrom(err, 'admin.invite.failed');
      },
    });
  }
}
