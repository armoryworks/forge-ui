import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { isCapabilityDisabledError } from '../../../../shared/errors/capability-disabled.error';

import { AdminService } from '../../services/admin.service';
import { ConnectionsRegistryService } from '../../services/connections-registry.service';
import { AdminUser } from '../../models/admin-user.model';
import { AuditLogEntry } from '../../models/audit-log-entry.model';
import { IntegrationRecord } from '../../models/integration-record.model';

/**
 * Admin → Overview landing page. Replaces the prior `/admin → /admin/users`
 * redirect with a small dashboard the admin sees first: people, capabilities,
 * integrations, recent audit. Each tile deep-links into its native tab so the
 * page is a launchpad, not a competing surface.
 *
 * Per-card load failures degrade the card to a "—" placeholder rather than
 * blowing up the whole page. The Connections card additionally tolerates
 * CAP-IDEN-AUTH-API-KEYS being disabled (silent via the typed
 * CapabilityDisabledError) and surfaces an explicit empty state.
 */
@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    LoadingBlockDirective,
  ],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly connectionsService = inject(ConnectionsRegistryService);
  private readonly capabilityService = inject(CapabilityService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(true);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly auditEntries = signal<AuditLogEntry[]>([]);
  protected readonly connections = signal<IntegrationRecord[]>([]);
  protected readonly connectionsAvailable = signal(true);

  /** Active-user count drives the People card's headline number. */
  protected readonly activeUserCount = computed(
    () => this.users().filter(u => u.isActive).length,
  );

  /** Distinct role chips rendered under the active count — a quick
      "what does the workforce look like" without leaving the page. Uses the
      first entry in users.roles as the primary role (matches the single-role
      picker in the user edit form). */
  protected readonly roleBreakdown = computed(() => {
    const counts = new Map<string, number>();
    const unassigned = this.translate.instant('adminOverview.unassignedRole');
    for (const u of this.users()) {
      if (!u.isActive) continue;
      const role = u.roles?.[0] ?? unassigned;
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([role, count]) => ({ role, count }));
  });

  protected readonly capabilityEnabled = computed(
    () => this.capabilityService.capabilities().filter(c => c.enabled).length,
  );
  protected readonly capabilityTotal = computed(
    () => this.capabilityService.capabilities().length,
  );

  protected readonly connectionCount = computed(() => this.connections().length);

  /** "Needs attention": API keys that the server marked Expired (IsActive
      still true but ExpiresAt elapsed). Pulled live from the connections
      registry so we don't duplicate that join here. */
  protected readonly expiredKeyCount = computed(
    () => this.connections().filter(r => r.status === 'Expired').length,
  );

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    // Parallel loads via separate subscriptions — each card degrades
    // independently. We don't gate the page on every call succeeding because
    // an install with one disabled capability shouldn't blank the dashboard.
    let pending = 3;
    const done = () => {
      if (--pending === 0) this.isLoading.set(false);
    };

    this.adminService.getUsers().subscribe({
      next: (users) => { this.users.set(users); done(); },
      error: () => done(),
    });

    this.adminService.getAuditLog({ page: 1, pageSize: 5 }).subscribe({
      next: (response) => { this.auditEntries.set(response.data); done(); },
      error: () => done(),
    });

    this.connectionsService.list().subscribe({
      next: (rows) => { this.connections.set(rows); done(); },
      error: (err: unknown) => {
        if (isCapabilityDisabledError(err)) {
          this.connectionsAvailable.set(false);
        }
        done();
      },
    });
  }

  protected goTo(route: string): void {
    this.router.navigateByUrl(route);
  }
}
