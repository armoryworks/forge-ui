import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../shared/services/snackbar.service';

interface IntegrationStatus {
  provider: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  isConfigured: boolean;
  logoUrl: string | null;
  sandboxUrl: string | null;
  sandboxSteps: string[];
}

interface IntegrationsResponse {
  showSandboxGuides: boolean;
  integrations: IntegrationStatus[];
}

/**
 * Phase 1m.7 — post-first-admin setup wizard for optional integrations.
 *
 * Lands the admin on a card list of integrations the install supports,
 * grouped by category (Communications, Service, Shipping, Accounting).
 * Each card asks: "Do you want to set this up?" with "Set up now" /
 * "Skip for now" buttons. Already-configured integrations show a
 * "Configured" chip and are skipped automatically.
 *
 * Design constraints:
 * - Optional + skippable. The wizard isn't a gate; the user can leave
 *   any time via "Done" + skip individual cards. Integrations they
 *   skip can be set up later from /admin/integrations.
 * - Catalog-driven. Reads from the existing GET /admin/settings catalog
 *   (descriptor-driven) so any new integration declared in
 *   IntegrationDescriptorCatalog auto-shows here.
 * - "Set up now" deep-links into the existing /admin/integrations page
 *   anchored to the right card — we don't duplicate the editor UI here.
 * - Completion is tracked client-side via a sessionStorage flag
 *   (setup.integrations-wizard-completed) so the user can leave +
 *   come back without losing place. A future enhancement: persist
 *   completion as a system_setting + auto-redirect new admins.
 */
@Component({
  selector: 'app-setup-integrations',
  standalone: true,
  imports: [RouterLink, TranslatePipe, LoadingBlockDirective],
  templateUrl: './setup-integrations.component.html',
  styleUrl: './setup-integrations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupIntegrationsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly integrations = signal<IntegrationStatus[]>([]);
  protected readonly loading = signal(false);
  protected readonly skipped = signal<Set<string>>(new Set());

  /** Group integrations into the four canonical categories. Already-
   *  configured ones surface to the top with a green "Configured" chip
   *  so reviewing is fast. */
  protected readonly grouped = computed(() => {
    const all = this.integrations();
    const groups: { category: string; items: IntegrationStatus[] }[] = [
      { category: 'communications', items: [] },
      { category: 'service', items: [] },
      { category: 'shipping', items: [] },
      { category: 'accounting', items: [] },
    ];
    for (const integration of all) {
      const group = groups.find(g => g.category === integration.category)
                ?? groups[groups.length - 1];
      group.items.push(integration);
    }
    // Sort within each group: configured first, then alphabetical.
    for (const g of groups) {
      g.items.sort((a, b) => {
        if (a.isConfigured !== b.isConfigured) return a.isConfigured ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    return groups.filter(g => g.items.length > 0);
  });

  protected readonly stats = computed(() => {
    const all = this.integrations();
    const configured = all.filter(i => i.isConfigured).length;
    const skippedCount = this.skipped().size;
    const remaining = all.length - configured - skippedCount;
    return { total: all.length, configured, skipped: skippedCount, remaining };
  });

  ngOnInit(): void {
    this.loading.set(true);
    fetch('/api/v1/admin/integrations', {
      headers: { Authorization: `Bearer ${localStorage.getItem('forge-token') ?? ''}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: IntegrationsResponse) => {
        this.integrations.set(data.integrations);
        this.loading.set(false);
      })
      .catch(err => {
        this.loading.set(false);
        if (err === 401 || err === 403) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.snackbar.error(this.translate.instant('setupIntegrations.loadFailed'));
      });

    // Restore previously-skipped integrations from sessionStorage so a
    // page-refresh mid-wizard doesn't lose progress.
    const storedSkipped = sessionStorage.getItem('setup-integrations.skipped');
    if (storedSkipped) {
      try {
        const parsed = JSON.parse(storedSkipped);
        if (Array.isArray(parsed)) {
          this.skipped.set(new Set(parsed));
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  protected setUp(integration: IntegrationStatus): void {
    // Deep-link into the existing /admin/integrations page. Hash anchor
    // not enabled there yet; the page just opens to the integrations
    // tab and the user finds the card. Wizard returns the user here
    // when they click "Back to setup wizard" from the admin page (link
    // not yet wired — future enhancement).
    this.router.navigate(['/admin/integrations'], { fragment: integration.provider });
  }

  protected skip(integration: IntegrationStatus): void {
    this.skipped.update(set => {
      const next = new Set(set);
      next.add(integration.provider);
      sessionStorage.setItem('setup-integrations.skipped', JSON.stringify([...next]));
      return next;
    });
  }

  protected isSkipped(provider: string): boolean {
    return this.skipped().has(provider);
  }

  protected finish(): void {
    sessionStorage.removeItem('setup-integrations.skipped');
    this.router.navigate(['/dashboard']);
  }

  protected categoryLabel(category: string): string {
    return this.translate.instant(`setupIntegrations.category.${category}`);
  }
}
