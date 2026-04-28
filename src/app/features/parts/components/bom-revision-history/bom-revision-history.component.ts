import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { BomRevisionDetail, BomRevisionSummary } from '../../models/bom-revision.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

/**
 * Phase 3 H4 / WU-20 — Read-only revision history widget for a part's BOM.
 *
 * Shows the list of revisions (newest first), highlighting the active one,
 * and allows expanding any revision to view its frozen component snapshot.
 * Editing happens elsewhere — every component-list mutation auto-creates
 * a new revision server-side; this widget is purely informational.
 */
@Component({
  selector: 'app-bom-revision-history',
  standalone: true,
  imports: [CommonModule, TranslatePipe, EmptyStateComponent],
  templateUrl: './bom-revision-history.component.html',
  styleUrl: './bom-revision-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BomRevisionHistoryComponent {
  private readonly partsService = inject(PartsService);
  private readonly translate = inject(TranslateService);

  /** The part whose BOM revisions to display. */
  readonly partId = input.required<number>();

  /**
   * Optional version-token: caller can bump this signal whenever a
   * BOM mutation is known to have happened so the revision list refreshes.
   * (We intentionally don't poll — the server is the source of truth and
   * the user-facing flow is a tab visit, not a long-lived stream.)
   */
  readonly refreshToken = input<number>(0);

  protected readonly revisions = signal<BomRevisionSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Currently expanded revision id → its loaded detail (or null while loading). */
  protected readonly expandedDetail = signal<BomRevisionDetail | null>(null);
  protected readonly expandedRevisionId = signal<number | null>(null);
  protected readonly detailLoading = signal(false);

  protected readonly hasRevisions = computed(() => this.revisions().length > 0);

  constructor() {
    // Reload whenever the part id or refresh token changes.
    effect(() => {
      const id = this.partId();
      // Read refreshToken to subscribe even if value is unused.
      this.refreshToken();
      if (id != null) this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.partsService.getBomRevisions(id).subscribe({
      next: (rows) => {
        this.revisions.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load revisions');
        this.loading.set(false);
      },
    });
  }

  protected toggleExpand(rev: BomRevisionSummary): void {
    if (this.expandedRevisionId() === rev.id) {
      this.expandedRevisionId.set(null);
      this.expandedDetail.set(null);
      return;
    }
    this.expandedRevisionId.set(rev.id);
    this.expandedDetail.set(null);
    this.detailLoading.set(true);
    this.partsService.getBomRevisionById(this.partId(), rev.id).subscribe({
      next: (d) => {
        this.expandedDetail.set(d);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
      },
    });
  }

  protected isExpanded(rev: BomRevisionSummary): boolean {
    return this.expandedRevisionId() === rev.id;
  }

  protected formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }
}
