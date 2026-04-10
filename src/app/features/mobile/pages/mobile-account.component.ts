import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-mobile-account',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  template: `
    <div class="mobile-page">
      <div class="profile-header">
        <app-avatar
          [initials]="user()?.initials ?? ''"
          [color]="user()?.avatarColor ?? '#6366f1'"
          size="lg" />
        <div class="profile-header__info">
          <h2 class="profile-header__name">{{ user()?.lastName }}, {{ user()?.firstName }}</h2>
          <p class="profile-header__email">{{ user()?.email }}</p>
        </div>
      </div>

      <nav class="account-links">
        <a class="account-link" routerLink="/account/profile">
          <span class="material-icons-outlined">person</span>
          <span>Profile</span>
          <span class="material-icons-outlined account-link__chevron">chevron_right</span>
        </a>
        <a class="account-link" routerLink="/account/integrations">
          <span class="material-icons-outlined">extension</span>
          <span>Integrations</span>
          <span class="material-icons-outlined account-link__chevron">chevron_right</span>
        </a>
        <a class="account-link" routerLink="/account/security">
          <span class="material-icons-outlined">lock</span>
          <span>Security</span>
          <span class="material-icons-outlined account-link__chevron">chevron_right</span>
        </a>
        <a class="account-link" routerLink="/account/customization">
          <span class="material-icons-outlined">palette</span>
          <span>Customization</span>
          <span class="material-icons-outlined account-link__chevron">chevron_right</span>
        </a>
      </nav>

      <div class="account-footer">
        <button class="action-btn" (click)="openDesktop()">
          <span class="material-icons-outlined">desktop_windows</span>
          Open Desktop View
        </button>
        <button class="action-btn action-btn--danger" (click)="logout()">
          <span class="material-icons-outlined">logout</span>
          Log Out
        </button>
      </div>
    </div>
  `,
  styles: `
    @use 'styles/variables' as *;

    .mobile-page { padding: $sp-lg; }

    .profile-header {
      display: flex;
      align-items: center;
      gap: $sp-lg;
      margin-bottom: $sp-xl;
      padding-bottom: $sp-lg;
      border-bottom: 1px solid var(--border);

      &__name {
        font-size: $font-size-md;
        font-weight: 600;
        margin: 0;
      }

      &__email {
        font-size: $font-size-xs;
        color: var(--text-muted);
        margin: $sp-xs 0 0;
      }
    }

    .account-links {
      display: flex;
      flex-direction: column;
      gap: $sp-sm;
      margin-bottom: $sp-xl;
    }

    .account-link {
      display: flex;
      align-items: center;
      gap: $sp-md;
      padding: $sp-md $sp-lg;
      text-decoration: none;
      color: var(--text);
      border: 1px solid var(--border);
      background: var(--surface);

      &:hover { border-color: var(--primary); }

      .material-icons-outlined:first-child {
        font-size: $icon-size-lg;
        color: var(--text-muted);
      }

      span:nth-child(2) {
        flex: 1;
        font-size: $font-size-base;
      }

      &__chevron {
        font-size: $icon-size-md;
        color: var(--text-muted);
      }
    }

    .account-footer {
      display: flex;
      flex-direction: column;
      gap: $sp-md;

      .action-btn {
        width: 100%;
        justify-content: center;
      }

      .action-btn--danger {
        color: var(--error);
        border-color: var(--error);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileAccountComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.authService.user;

  protected openDesktop(): void {
    this.router.navigate(['/dashboard']);
  }

  protected logout(): void {
    this.authService.logout();
  }
}
