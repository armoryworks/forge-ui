import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { MobileEntityLinkService } from '../services/mobile-entity-link.service';

@Component({
  selector: 'app-mobile-account',
  standalone: true,
  imports: [RouterLink, TranslatePipe, AvatarComponent],
  templateUrl: './mobile-account.component.html',
  styleUrl: './mobile-account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileAccountComponent {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly entityLinks = inject(MobileEntityLinkService);

  protected readonly user = this.authService.user;
  protected readonly theme = this.themeService.theme;

  protected openDesktop(): void {
    this.entityLinks.openDesktop({ path: ['/dashboard'] });
  }

  protected openSetupWizard(): void {
    this.entityLinks.openDesktop({ path: ['/onboarding'] });
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected logout(): void {
    this.authService.logout();
  }
}
