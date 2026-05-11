import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { Router } from '@angular/router';
import { LeadsService } from '../../services/leads.service';
import { SuppressedLeadSummary } from '../../models/suppression.model';

@Component({
  selector: 'app-leads-suppression',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe, MatTooltipModule,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './leads-suppression.component.html',
  styleUrl: './leads-suppression.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsSuppressionComponent implements OnInit {
  private readonly service = inject(LeadsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly rows = signal<SuppressedLeadSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly pendingIds = signal<Set<number>>(new Set());

  protected readonly columns: ColumnDef[] = [
    { field: 'companyName', header: this.translate.instant('customers.companyName'), sortable: true },
    { field: 'contactName', header: this.translate.instant('customers.contactName'), sortable: true },
    { field: 'email', header: this.translate.instant('common.email'), sortable: true },
    { field: 'phone', header: this.translate.instant('common.phone'), sortable: true, width: '130px' },
    { field: 'channels', header: this.translate.instant('leads.suppression.colChannels'), width: '220px' },
    { field: 'cooldownUntil', header: this.translate.instant('leads.suppression.colCooldownUntil'), type: 'date', sortable: true, width: '120px' },
    { field: 'cooldownReasonCode', header: this.translate.instant('leads.suppression.colReason'), width: '140px' },
    { field: 'prefsUpdatedAt', header: this.translate.instant('common.lastUpdated'), type: 'date', sortable: true, width: '140px' },
    { field: 'actions', header: '', width: '180px', align: 'right' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.listSuppressed().subscribe({
      next: (data) => { this.rows.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openLead(row: SuppressedLeadSummary): void {
    this.router.navigate(['/leads'], { queryParams: { detail: `lead:${row.leadId}` } });
  }

  protected isPending(leadId: number): boolean {
    return this.pendingIds().has(leadId);
  }

  /**
   * Per-channel unsuppress. Patches the lead's outreach-preferences row
   * with the relevant opt-out flag flipped back to false. The server
   * tracks the change in activity log so an audit trail survives.
   *
   * Cooldown clear is a special case — patches cooldownUntil to null
   * explicitly. UpdateOutreachPreferencesRequest treats null as "clear"
   * rather than "leave alone" specifically for cooldownUntil.
   */
  protected unsuppressChannel(row: SuppressedLeadSummary, channel: 'email' | 'call' | 'sms', ev?: Event): void {
    ev?.stopPropagation();
    this.markPending(row.leadId);
    // Round-trip existing cooldown values explicitly. The server handler
    // treats `CooldownUntil != prefs.CooldownUntil` as a change request,
    // which means an unrelated payload (only flipping an opt-out) would
    // null-out an existing cooldown. Pinning the cooldown fields keeps
    // them stable while we only mutate the channel of interest.
    const channelPatch =
      channel === 'email' ? { emailOptOut: false, emailOptOutSource: 'manual-unsuppress' } :
      channel === 'call'  ? { callOptOut: false, callOptOutSource: 'manual-unsuppress' } :
                            { smsOptOut: false, smsOptOutSource: 'manual-unsuppress' };
    const payload = { ...channelPatch, cooldownUntil: row.cooldownUntil };
    this.service.updateOutreachPreferences(row.leadId, payload).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('leads.suppression.unsuppressed', {
          channel: this.translate.instant('leads.suppression.channel.' + channel),
        }));
        this.clearPending(row.leadId);
        this.load();
      },
      error: () => this.clearPending(row.leadId),
    });
  }

  protected clearCooldown(row: SuppressedLeadSummary, ev?: Event): void {
    ev?.stopPropagation();
    this.markPending(row.leadId);
    this.service.updateOutreachPreferences(row.leadId, { cooldownUntil: null }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('leads.suppression.cooldownCleared'));
        this.clearPending(row.leadId);
        this.load();
      },
      error: () => this.clearPending(row.leadId),
    });
  }

  private markPending(leadId: number): void {
    const next = new Set(this.pendingIds());
    next.add(leadId);
    this.pendingIds.set(next);
  }

  private clearPending(leadId: number): void {
    const next = new Set(this.pendingIds());
    next.delete(leadId);
    this.pendingIds.set(next);
  }
}
