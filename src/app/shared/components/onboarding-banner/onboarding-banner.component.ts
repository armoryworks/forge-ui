import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { EmployeeProfileService } from '../../../features/account/services/employee-profile.service';
import { OnboardingService } from '../../../features/onboarding/onboarding.service';

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
  private readonly profileService = inject(EmployeeProfileService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  private readonly dismissed = signal(false);
  protected readonly confirmingBypass = signal(false);
  protected readonly bypassing = signal(false);

  protected readonly visible = computed(() => {
    if (this.dismissed()) return false;
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

  protected readonly incompleteCount = this.profileService.incompleteCount;

  protected dismiss(): void {
    this.dismissed.set(true);
  }

  protected goToIncomplete(): void {
    this.router.navigate([this.profileService.firstIncompleteRoute()]);
  }

  protected promptBypass(): void {
    this.confirmingBypass.set(true);
  }

  protected cancelBypass(): void {
    this.confirmingBypass.set(false);
  }

  protected confirmBypass(): void {
    this.bypassing.set(true);
    this.onboardingService.bypass().subscribe({
      next: () => {
        this.profileService.load();
        this.dismissed.set(true);
      },
      error: () => this.bypassing.set(false),
    });
  }
}
