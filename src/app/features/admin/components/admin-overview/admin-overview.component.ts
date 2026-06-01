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
import { ScheduledTask } from '../../models/scheduled-task.model';
import { StorageUsage } from '../../models/storage-usage.model';

/**
 * Compliance statuses that warrant admin attention — Overdue items risk
 * regulatory non-compliance, ReverificationDue is the work-authorization
 * expiration warning window. NotStarted / InProgress are tracked separately
 * via missingComplianceItems on the user row.
 */
const I9_ATTENTION_STATUSES = new Set([
  'Section2Overdue',
  'ReverificationDue',
  'ReverificationOverdue',
]);

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
  protected readonly scheduledTasks = signal<ScheduledTask[]>([]);
  protected readonly storageUsage = signal<StorageUsage[]>([]);

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

  /** Compliance: count of active users with any unmet compliance item. The
      missingComplianceItems array is the server's catch-all "what's still
      open against this user" — uses the same field the per-user detail
      panel surfaces, so the count here matches what the admin will see
      after drilling in. */
  protected readonly complianceOpenCount = computed(
    () => this.users().filter(u =>
      u.isActive && u.missingComplianceItems.length > 0,
    ).length,
  );

  /** Subset specifically gated on I-9 work-authorization status —
      Section2Overdue / ReverificationDue / ReverificationOverdue are the
      regulator-facing items where a missed deadline carries actual
      consequences. Shown as a sub-alert chip on the Compliance card. */
  protected readonly i9AttentionCount = computed(
    () => this.users().filter(u =>
      u.isActive && u.i9Status !== null && I9_ATTENTION_STATUSES.has(u.i9Status),
    ).length,
  );

  /** Scheduled tasks active right now (admin-defined recurring tasks; see
      ScheduledTasksController). Inactive rows are excluded — they exist as
      drafts / paused but shouldn't count toward "what's running." */
  protected readonly activeScheduledTaskCount = computed(
    () => this.scheduledTasks().filter(t => t.isActive).length,
  );

  /** Soonest upcoming run across active tasks, or null when nothing is
      scheduled. Drives the "Next: <date>" sub-line on the card. */
  protected readonly nextScheduledRun = computed(() => {
    const upcoming = this.scheduledTasks()
      .filter(t => t.isActive && t.nextRunAt !== null)
      .map(t => new Date(t.nextRunAt!).getTime());
    if (upcoming.length === 0) return null;
    return new Date(Math.min(...upcoming));
  });

  /** Sum of file counts across every entity bucket. */
  protected readonly totalFileCount = computed(
    () => this.storageUsage().reduce((acc, b) => acc + b.fileCount, 0),
  );

  /** Sum of bytes across every entity bucket, pre-formatted for display. */
  protected readonly totalStorageDisplay = computed(
    () => formatBytes(this.storageUsage().reduce((acc, b) => acc + b.totalSizeBytes, 0)),
  );

  /** Biggest entity-type bucket by size — gives the admin a quick "where
      is the storage going" data point on the card without needing a
      dedicated drill-in page. */
  protected readonly topStorageEntity = computed(() => {
    const buckets = this.storageUsage();
    if (buckets.length === 0) return null;
    const top = [...buckets].sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)[0];
    return { entityType: top.entityType, display: formatBytes(top.totalSizeBytes) };
  });

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    // Parallel loads via separate subscriptions — each card degrades
    // independently. We don't gate the page on every call succeeding because
    // an install with one disabled capability shouldn't blank the dashboard.
    let pending = 5;
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

    this.adminService.getScheduledTasks().subscribe({
      next: (tasks) => { this.scheduledTasks.set(tasks); done(); },
      error: () => done(),
    });

    this.adminService.getStorageUsage().subscribe({
      next: (usage) => { this.storageUsage.set(usage); done(); },
      error: () => done(),
    });
  }

  protected goTo(route: string): void {
    this.router.navigateByUrl(route);
  }
}

/**
 * Compact byte → human-readable formatter used by the Storage card. Picks
 * the closest binary unit (KiB / MiB / GiB / TiB) and trims to one decimal
 * once past KB. Local-only — not promoted to a shared util because no other
 * surface needs byte-formatting today; lift it when the second consumer
 * shows up.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let unitIndex = -1;
  let value = bytes;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
