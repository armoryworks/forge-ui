import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CommunicationService } from '../../services/communication.service';
import { SalesOrderAuthorization } from '../../models/sales-order-authorization.model';

/**
 * The Authorized-by line.
 *
 * <p>Reads: <em>Authorized by PO-8832.pdf — received 15 Aug 2026 09:12 from
 * bob@bobsparts.com — sha256:ab3f91…</em>, with each part clickable through to
 * the document, the original message, and the chain of agreements behind it.</p>
 *
 * <p>Renders nothing when an order has no authorizing attestation. Most orders
 * do not have one — keyed in, or converted from a quote — and an empty state
 * saying "no proof of intent" on every one of them would be noise that trains
 * people to ignore the line where it matters.</p>
 */
@Component({
  selector: 'app-authorized-by',
  standalone: true,
  imports: [DatePipe, MatTooltipModule, RouterLink, TranslatePipe],
  templateUrl: './authorized-by.component.html',
  styleUrl: './authorized-by.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorizedByComponent {
  private readonly service = inject(CommunicationService);
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly salesOrderId = input.required<number>();

  protected readonly authorization = signal<SalesOrderAuthorization | null>(null);
  protected readonly loading = signal(false);
  protected readonly chainExpanded = signal(false);

  /** Nothing to show until an order actually has proof behind it. */
  protected readonly hasAuthorization = computed(() => this.authorization() !== null);

  /** First 12 hex characters. The full digest is on the tooltip and the copy action. */
  protected readonly shortHash = computed(() => {
    const hash = this.authorization()?.sha256;
    return hash ? `${hash.slice(0, 12)}…` : null;
  });

  protected readonly documentLabel = computed(() => {
    const auth = this.authorization();
    if (!auth) return '';
    return auth.filename ?? this.translate.instant('authorizedBy.untitledDocument');
  });

  protected readonly chainCount = computed(() => this.authorization()?.authorizationChain.length ?? 0);

  constructor() {
    effect(() => {
      const id = this.salesOrderId();
      if (!id) return;

      this.loading.set(true);
      this.service.getAuthorization(id).subscribe({
        next: (auth) => {
          this.authorization.set(auth);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  protected toggleChain(): void {
    this.chainExpanded.update((v) => !v);
  }

  /**
   * Copies the full digest, not the truncated one. Verifying a hash means
   * running it against the stored bytes, and a shortened value cannot do that.
   */
  protected copyHash(): void {
    const hash = this.authorization()?.sha256;
    if (!hash) return;

    this.clipboard.copy(hash);
    this.snackbar.success(this.translate.instant('authorizedBy.hashCopied'));
  }
}
