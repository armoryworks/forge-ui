import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { PortalService } from './services/portal.service';

/**
 * Portal shell. Distinct from the employee app shell (no sidebar nav, no
 * notification bell, no scanner). Single horizontal header with the
 * customer's name + a logout button; nav is a top tab bar between the
 * four portal-visible entity types.
 */
@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './portal-layout.component.html',
  styleUrl: './portal-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalLayoutComponent {
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);

  protected readonly identity = this.portal.identity;
  protected readonly initials = computed(() => {
    const i = this.identity();
    if (!i) return '';
    return `${i.contactFirstName.charAt(0)}${i.contactLastName.charAt(0)}`.toUpperCase();
  });

  protected logout(): void {
    this.portal.logout();
    this.router.navigate(['/portal/login']);
  }
}
