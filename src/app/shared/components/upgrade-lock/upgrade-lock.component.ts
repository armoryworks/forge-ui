import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { UpgradeLockService } from '../../services/upgrade-lock.service';

/**
 * Full-screen, non-dismissible lock shown on every console while this install
 * upgrades — not only the admin's. A shop floor of tablets should not discover
 * an upgrade by collecting errors.
 *
 * The copy is deliberately generic: no version, no tier, no log. Operator
 * detail lives on the admin Updates screen, behind authentication.
 */
@Component({
  selector: 'app-upgrade-lock',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './upgrade-lock.component.html',
  styleUrl: './upgrade-lock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpgradeLockComponent {
  private readonly upgradeLock = inject(UpgradeLockService);

  protected readonly locked = this.upgradeLock.locked;
  protected readonly apiUnreachable = this.upgradeLock.apiUnreachable;
}
