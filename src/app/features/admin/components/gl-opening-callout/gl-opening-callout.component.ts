import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CapabilityService } from '../../../../shared/services/capability.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const MIGRATION_CAPABILITY = 'CAP-ACCT-MIGRATION';

/**
 * Shown when turning on CAP-ACCT-FULLGL is refused because a book has no opening journal
 * (409 `capability-gl-opening-balances`). Walks the admin through the cutover: turn on the
 * accounting migration wizard, have a Controller post the opening journal, then turn on full GL.
 */
@Component({
  selector: 'app-gl-opening-callout',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './gl-opening-callout.component.html',
  styleUrl: './gl-opening-callout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlOpeningCalloutComponent {
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  /** The server's refusal text, shown verbatim under the heading. */
  readonly reason = input<string | null>(null);
  readonly dismissed = output<void>();

  protected readonly isController = inject(AuthService).hasAnyRole(['Controller']);
  protected readonly migrationEnabled = computed(() => {
    this.capabilities.capabilities();
    return this.capabilities.isEnabled(MIGRATION_CAPABILITY);
  });
  protected readonly enabling = signal(false);

  protected enableMigration(): void {
    if (this.enabling()) return;
    this.enabling.set(true);
    this.capabilities.setEnabled(MIGRATION_CAPABILITY, true).subscribe({
      next: () => {
        this.enabling.set(false);
        this.snackbar.success(this.translate.instant('admin.glOpening.migrationEnabled'));
        this.capabilities.load().subscribe();
      },
      error: (err: unknown) => {
        this.enabling.set(false);
        this.snackbar.errorFrom(err, 'admin.glOpening.migrationFailed');
      },
    });
  }
}
