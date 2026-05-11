import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SampleShipmentsService } from '../../services/sample-shipments.service';
import { SampleShipment, SampleShipmentStatus } from '../../models/sample-shipment.model';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

/**
 * Phase 1r / Batch 16 — sample shipment tracker. Shows pre-quote sample
 * parts sent across all leads with their lifecycle status. Sales managers
 * use this surface to spot stale samples (delivered + no follow-up quote)
 * and reps use it to gauge where each prospect is in the sample-evaluation
 * loop.
 *
 * No edit-in-place here yet — the dialog/edit flow lives on the lead
 * detail (where the sample lives functionally). This page is the
 * cross-lead read view.
 */
@Component({
  selector: 'app-leads-samples',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, ReactiveFormsModule, TranslatePipe,
    MatMenuModule, MatTooltipModule,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    SelectComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './leads-samples.component.html',
  styleUrl: './leads-samples.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsSamplesComponent {
  private readonly service = inject(SampleShipmentsService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly samples = signal<SampleShipment[]>([]);
  protected readonly loading = signal(true);
  // Per-row in-flight markers so transition buttons can dim/disable while
  // the PATCH is still inflight. Single Set so multiple rows in flight
  // don't step on each other.
  protected readonly pendingIds = signal<Set<number>>(new Set());

  protected readonly statusFilter = new FormControl<string>('all', { nonNullable: true });

  protected readonly statusOptions: SelectOption[] = [
    { value: 'all', label: this.translate.instant('leads.samples.statusAll') },
    { value: 'open', label: this.translate.instant('leads.samples.statusOpen') },
    { value: 'Requested', label: this.translate.instant('leads.samples.status.Requested') },
    { value: 'Approved', label: this.translate.instant('leads.samples.status.Approved') },
    { value: 'Shipped', label: this.translate.instant('leads.samples.status.Shipped') },
    { value: 'Delivered', label: this.translate.instant('leads.samples.status.Delivered') },
    { value: 'QuotedFromSample', label: this.translate.instant('leads.samples.status.QuotedFromSample') },
    { value: 'LostFromSample', label: this.translate.instant('leads.samples.status.LostFromSample') },
    { value: 'Stale', label: this.translate.instant('leads.samples.status.Stale') },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'leadId', header: this.translate.instant('leads.samples.colLead'), sortable: true, width: '100px' },
    { field: 'partDescription', header: this.translate.instant('leads.samples.colPart'), sortable: true },
    { field: 'quantity', header: this.translate.instant('leads.samples.colQty'), sortable: true, type: 'number', align: 'right', width: '70px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '140px' },
    { field: 'requestedAt', header: this.translate.instant('leads.samples.colRequested'), sortable: true, type: 'date', width: '120px' },
    { field: 'shippedAt', header: this.translate.instant('leads.samples.colShipped'), sortable: true, type: 'date', width: '120px' },
    { field: 'deliveredAt', header: this.translate.instant('leads.samples.colDelivered'), sortable: true, type: 'date', width: '120px' },
    { field: 'costToUs', header: this.translate.instant('leads.samples.colCost'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'trackingNumber', header: this.translate.instant('leads.samples.colTracking'), sortable: true, width: '160px' },
    { field: 'actions', header: '', width: '110px', align: 'right' },
  ];

  protected readonly filteredSamples = computed(() => {
    const all = this.samples();
    const filter = this.statusFilter.value;
    if (filter === 'all') return all;
    if (filter === 'open') {
      return all.filter(s => s.status !== 'QuotedFromSample' && s.status !== 'LostFromSample' && s.status !== 'Stale');
    }
    return all.filter(s => s.status === filter);
  });

  constructor() {
    this.load();
    this.statusFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      // computed reacts via control's valueChanges → no explicit work needed
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.samples.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected getStatusClass(status: SampleShipmentStatus): string {
    const map: Record<SampleShipmentStatus, string> = {
      Requested: 'chip--info',
      Approved: 'chip--info',
      Shipped: 'chip--primary',
      Delivered: 'chip--primary',
      QuotedFromSample: 'chip--success',
      LostFromSample: 'chip--error',
      Stale: 'chip--warning',
    };
    return `chip ${map[status] ?? 'chip--muted'}`;
  }

  protected openLead(sample: SampleShipment): void {
    this.router.navigate(['/leads'], { queryParams: { detail: `lead:${sample.leadId}` } });
  }

  /**
   * Direct linear transitions only — Requested → Approved → Shipped →
   * Delivered. Outcome states (QuotedFromSample / LostFromSample / Stale)
   * are reached via the Outcome menu since they need operator intent
   * rather than "advance the lifecycle one step." Stale is auto-set by
   * the nightly job; offering it here would shortcut the cooldown.
   */
  protected nextStatus(s: SampleShipment): SampleShipmentStatus | null {
    if (s.status === 'Requested') return 'Approved';
    if (s.status === 'Approved') return 'Shipped';
    if (s.status === 'Shipped') return 'Delivered';
    return null;
  }

  protected canAdvance(s: SampleShipment): boolean {
    return this.nextStatus(s) !== null;
  }

  protected isPending(id: number): boolean {
    return this.pendingIds().has(id);
  }

  protected advance(s: SampleShipment, ev?: Event): void {
    ev?.stopPropagation();
    const next = this.nextStatus(s);
    if (!next) return;
    this.transition(s, next);
  }

  protected setOutcome(s: SampleShipment, next: SampleShipmentStatus, ev?: Event): void {
    ev?.stopPropagation();
    this.transition(s, next);
  }

  private transition(s: SampleShipment, next: SampleShipmentStatus): void {
    const pending = new Set(this.pendingIds());
    pending.add(s.id);
    this.pendingIds.set(pending);

    // Stamp the appropriate timestamp on the way through. The server will
    // happily round-trip them; we set them client-side too so the row
    // reflects the new state immediately on next reload.
    const now = new Date().toISOString();
    this.service.update(s.id, {
      partId: s.partId,
      partDescription: s.partDescription,
      quantity: s.quantity,
      status: next,
      requestedAt: s.requestedAt,
      shippedAt: next === 'Shipped' && !s.shippedAt ? now : s.shippedAt,
      deliveredAt: next === 'Delivered' && !s.deliveredAt ? now : s.deliveredAt,
      costToUs: s.costToUs,
      chargedAmount: s.chargedAmount,
      trackingNumber: s.trackingNumber,
      carrier: s.carrier,
      notes: s.notes,
    }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('leads.samples.transitioned', {
          status: this.translate.instant('leads.samples.status.' + next),
        }));
        this.clearPending(s.id);
        this.load();
      },
      error: () => this.clearPending(s.id),
    });
  }

  private clearPending(id: number): void {
    const pending = new Set(this.pendingIds());
    pending.delete(id);
    this.pendingIds.set(pending);
  }
}
