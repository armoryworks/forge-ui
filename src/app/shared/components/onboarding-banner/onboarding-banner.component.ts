import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { CapabilityService } from '../../services/capability.service';
import { LayoutService } from '../../services/layout.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { EmployeeProfileService } from '../../../features/account/services/employee-profile.service';
import { OnboardingService } from '../../../features/onboarding/onboarding.service';

export const ONBOARDING_BANNER_DISMISSED_UNTIL_KEY = 'onboarding-banner:dismissed-until';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const HR_TRACKING_CAPABILITY = 'CAP-HR-HIRE';

@Component({
  selector: 'app-onboarding-banner',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe],
  templateUrl: './onboarding-banner.component.html',
  styleUrl: './onboarding-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingBannerComponent {
  private readonly authService = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly preferences = inject(UserPreferencesService);
  private readonly profileService = inject(EmployeeProfileService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  private readonly bypassed = signal(false);
  protected readonly confirmingBypass = signal(false);
  protected readonly bypassing = signal(false);
  protected readonly bypassError = signal<string | null>(null);

  protected readonly hrTrackingOn = computed(() => this.capabilities.isEnabled(HR_TRACKING_CAPABILITY));

  private readonly dismissed = computed(() => {
    const until = this.preferences.get<string>(ONBOARDING_BANNER_DISMISSED_UNTIL_KEY);
    if (!until) return false;
    const expiresAt = Date.parse(until);
    return !Number.isNaN(expiresAt) && expiresAt > Date.now();
  });

  protected readonly visible = computed(() => {
    if (!this.hrTrackingOn()) return false;
    if (this.bypassed() || this.dismissed()) return false;
    if (this.layout.isAccountRoute()) return false;
    if (this.layout.isOnboardingRoute()) return false;
    if (!this.authService.isAuthenticated()) return false;
    const user = this.authService.user();
    if (!user) return false;
    if (user.profileComplete) return false;
    const completeness = this.profileService.completeness();
    if (!completeness) return !user.profileComplete;
    return !completeness.isComplete;
  });

  // F5 — count incomplete sections (Contact / Emergency / Tax Forms) so the
  // banner agrees with the account sidebar's warning triangles, instead of an
  // item-level count that didn't visibly map to the 3 flagged sections.
  protected readonly incompleteSectionCount = this.profileService.incompleteSectionCount;

  protected dismiss(): void {
    this.preferences.set(
      ONBOARDING_BANNER_DISMISSED_UNTIL_KEY,
      new Date(Date.now() + DISMISS_DURATION_MS).toISOString(),
    );
  }

  protected goToIncomplete(): void {
    this.router.navigate([this.profileService.firstIncompleteRoute()]);
  }

  protected promptBypass(): void {
    this.bypassError.set(null);
    this.confirmingBypass.set(true);
  }

  protected cancelBypass(): void {
    this.bypassError.set(null);
    this.confirmingBypass.set(false);
  }

  protected confirmBypass(): void {
    this.bypassError.set(null);
    this.bypassing.set(true);
    this.onboardingService.bypass().subscribe({
      next: () => {
        this.bypassing.set(false);
        this.profileService.load();
        this.bypassed.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.bypassing.set(false);
        this.bypassError.set(err?.error?.detail ?? err?.error?.title ?? err?.message ?? '');
      },
    });
  }
}
