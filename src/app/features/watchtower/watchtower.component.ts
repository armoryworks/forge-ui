import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { CalendarService } from '../calendar/services/calendar.service';
import { WatchtowerService } from './services/watchtower.service';
import { RegulatoryProposal } from './models/regulatory-proposal.model';
import { RegulatorySource } from './models/regulatory-source.model';
import {
  ApplyProposalDialogComponent,
  ApplyProposalDialogData,
  ApplyProposalDialogResult,
} from './components/apply-proposal-dialog/apply-proposal-dialog.component';
import { WatchtowerTab } from './models/watchtower-tab.model';
import { TabListDirective, TabDirective } from '../../shared/directives/tab-list.directive';
import { ScrollCueDirective } from '../../shared/directives/scroll-cue.directive';
import { DateTimePipe } from '../../shared/pipes/date-time.pipe';

/**
 * Regulatory Watchtower workspace — the review surface for the CAP-EXT-WATCHTOWER backend.
 * Proposals inbox (apply → optional compliance-calendar deadline / dismiss), monitored-sources
 * view, and a manual poll trigger. Tabs are URL-driven (`/watchtower/:tab`).
 */
const DOMAIN_LABEL_KEYS: Readonly<Record<string, string>> = {
  'cross-cutting': 'watchtower.domain.crossCutting',
  environmental: 'watchtower.domain.environmental',
  firearms: 'watchtower.domain.firearms',
  food: 'watchtower.domain.food',
  labor: 'watchtower.domain.labor',
  'product-safety': 'watchtower.domain.productSafety',
  safety: 'watchtower.domain.safety',
  tax: 'watchtower.domain.tax',
};

const FEED_TYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  Api: 'watchtower.feedType.api',
  Rss: 'watchtower.feedType.rss',
  Email: 'watchtower.feedType.email',
  Bulk: 'watchtower.feedType.bulk',
  Scrape: 'watchtower.feedType.scrape',
};

const STATUS_LABEL_KEYS: Readonly<Record<string, string>> = {
  Pending: 'watchtower.status.pending',
  Applied: 'watchtower.status.applied',
  Dismissed: 'watchtower.status.dismissed',
};

@Component({
  selector: 'app-watchtower',
  standalone: true,
  imports: [TabListDirective, TabDirective, ScrollCueDirective, ReactiveFormsModule, DatePipe, DateTimePipe, TranslatePipe, PageLayoutComponent, SelectComponent, EmptyStateComponent],
  templateUrl: './watchtower.component.html',
  styleUrl: './watchtower.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchtowerComponent {
  private readonly service = inject(WatchtowerService);
  private readonly calendarService = inject(CalendarService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as WatchtowerTab) ?? 'proposals')),
    { initialValue: 'proposals' as WatchtowerTab },
  );

  protected readonly proposals = signal<RegulatoryProposal[]>([]);
  protected readonly sources = signal<RegulatorySource[]>([]);
  protected readonly loading = signal(false);
  protected readonly polling = signal(false);
  private readonly eventTypeOptions = signal<SelectOption[]>([]);

  protected readonly statusControl = new FormControl<string>('Pending', { nonNullable: true });
  private readonly statusFilter = toSignal(this.statusControl.valueChanges, { initialValue: 'Pending' });

  protected readonly statusOptions: SelectOption[] = [
    { value: 'Pending', label: this.translate.instant('watchtower.status.pending') },
    { value: 'Applied', label: this.translate.instant('watchtower.status.applied') },
    { value: 'Dismissed', label: this.translate.instant('watchtower.status.dismissed') },
    { value: 'all', label: this.translate.instant('watchtower.status.all') },
  ];

  protected readonly filteredProposals = computed(() => {
    const status = this.statusFilter();
    const all = this.proposals();
    return status === 'all' ? all : all.filter(p => p.status === status);
  });

  protected readonly pendingCount = computed(() => this.proposals().filter(p => p.status === 'Pending').length);

  constructor() {
    this.loadProposals();
    this.loadSources();
    // Event-Types (nested in the compliance super-groups) feed the apply dialog's optional
    // "turn this into a calendar deadline" target. Degrade to none if unavailable.
    this.calendarService.getSuperGroups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (groups) => this.eventTypeOptions.set(
        groups.flatMap(g => g.eventTypes.map(t => ({ value: t.id, label: `${g.name} — ${t.name}` }))),
      ),
      error: () => this.eventTypeOptions.set([]),
    });
  }

  protected domainLabel(domain: string): string {
    const key = DOMAIN_LABEL_KEYS[domain];
    if (key) return this.translate.instant(key);
    return domain.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  protected feedTypeLabel(feedType: string): string {
    const key = FEED_TYPE_LABEL_KEYS[feedType];
    return key ? this.translate.instant(key) : feedType;
  }

  protected statusLabel(status: string): string {
    const key = STATUS_LABEL_KEYS[status];
    return key ? this.translate.instant(key) : status;
  }

  protected switchTab(tab: WatchtowerTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  private loadProposals(): void {
    this.loading.set(true);
    this.service.getProposals().subscribe({
      next: (p) => { this.proposals.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadSources(): void {
    this.service.getSources().subscribe({
      next: (s) => this.sources.set(s),
      error: () => this.sources.set([]),
    });
  }

  protected poll(): void {
    this.polling.set(true);
    this.service.poll().subscribe({
      next: (r) => {
        this.polling.set(false);
        if (r.activeSources === 0) {
          this.snackbar.info(this.translate.instant('watchtower.noActiveSources'));
        } else if (r.failedSources > 0) {
          this.snackbar.warn(this.translate.instant('watchtower.polledWithFailures', { count: r.created, failed: r.failedSources }));
        } else {
          this.snackbar.success(this.translate.instant('watchtower.polled', { count: r.created }));
        }
        this.loadProposals();
        this.loadSources();
      },
      error: () => this.polling.set(false),
    });
  }

  protected applyProposal(proposal: RegulatoryProposal): void {
    this.dialog.open<ApplyProposalDialogComponent, ApplyProposalDialogData, ApplyProposalDialogResult>(
      ApplyProposalDialogComponent,
      { width: '480px', autoFocus: 'input', data: { proposalTitle: proposal.title, eventTypeOptions: this.eventTypeOptions() } },
    ).afterClosed().subscribe(result => {
      if (!result) return;
      this.service.applyProposal(proposal.id, result).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('watchtower.applied'));
          this.loadProposals();
        },
      });
    });
  }

  protected dismissProposal(proposal: RegulatoryProposal): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('watchtower.dismissTitle'),
        message: this.translate.instant('watchtower.dismissMessage', { title: proposal.title }),
        confirmLabel: this.translate.instant('watchtower.dismiss'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.dismissProposal(proposal.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('watchtower.dismissed'));
          this.loadProposals();
        },
      });
    });
  }

  protected statusChipClass(status: string): string {
    switch (status) {
      case 'Applied': return 'chip chip--success';
      case 'Dismissed': return 'chip chip--muted';
      default: return 'chip chip--warning';
    }
  }
}
