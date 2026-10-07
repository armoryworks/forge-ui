import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-mobile-account',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  templateUrl: './mobile-account.component.html',
  styleUrl: './mobile-account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileAccountComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly user = this.authService.user;
  protected readonly theme = this.themeService.theme;

  protected openDesktop(): void {
    try {
      localStorage.setItem('preferDesktop', 'true');
    } catch {
      this.snackbar.error('This browser is blocking site storage, so the desktop view cannot be remembered.');
      return;
    }
    this.router.navigate(['/dashboard']);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected logout(): void {
    this.authService.logout();
  }
}
