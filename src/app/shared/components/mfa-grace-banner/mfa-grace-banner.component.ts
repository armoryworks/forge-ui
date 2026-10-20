import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { LayoutService } from '../../services/layout.service';

export const MFA_GRACE_BANNER_DISMISSED_KEY = 'mfa-grace-banner:dismissed';

@Component({
  selector: 'app-mfa-grace-banner',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe],
  templateUrl: './mfa-grace-banner.component.html',
  styleUrl: './mfa-grace-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaGraceBannerComponent {
  private readonly authService = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  private readonly dismissedFor = signal<number | null>(readDismissed());

  private readonly deadline = computed(() => {
    const raw = this.authService.user()?.mfaEnrollmentDeadline;
    if (!raw) return null;
    const at = new Date(raw);
    return Number.isNaN(at.getTime()) || at.getTime() <= Date.now() ? null : at;
  });

  protected readonly deadlineLabel = computed(() => {
    const at = this.deadline();
    return at ? at.toLocaleDateString(this.language.currentLanguage(), { dateStyle: 'long' }) : '';
  });

  protected readonly visible = computed(() => {
    if (!this.authService.isAuthenticated() || this.layout.isAccountRoute()) return false;
    const user = this.authService.user();
    if (!user || !this.deadline()) return false;
    return this.dismissedFor() !== user.id;
  });

  protected setUp(): void {
    void this.router.navigate(['/account/security']);
  }

  protected dismiss(): void {
    const userId = this.authService.user()?.id ?? null;
    this.dismissedFor.set(userId);
    sessionStorage.setItem(MFA_GRACE_BANNER_DISMISSED_KEY, String(userId));
  }
}

function readDismissed(): number | null {
  const raw = sessionStorage.getItem(MFA_GRACE_BANNER_DISMISSED_KEY);
  return raw ? Number(raw) : null;
}
