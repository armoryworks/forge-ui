import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { ReviewsService } from '../../services/reviews.service';
import { ReviewCycle } from '../../models/review-cycle.model';
import { PerformanceReview } from '../../models/performance-review.model';
import { ReviewListComponent } from '../review-list/review-list.component';
import { ReviewCycleDialogComponent } from '../review-cycle-dialog/review-cycle-dialog.component';

@Component({
  selector: 'app-review-cycles-panel',
  standalone: true,
  imports: [TranslatePipe, DateOnlyPipe, DataTableComponent, ColumnCellDirective, LoadingBlockDirective, ReviewListComponent],
  templateUrl: './review-cycles-panel.component.html',
  styleUrl: './review-cycles-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCyclesPanelComponent {
  private readonly reviews = inject(ReviewsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly opened = output<PerformanceReview>();

  protected readonly canManage = computed(() => this.auth.hasAnyRole(['Admin']));
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly cycles = signal<ReviewCycle[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.cycles().find(c => c.id === this.selectedId()) ?? null);
  protected readonly cycleReviews = signal<PerformanceReview[]>([]);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'reviews.cycles.cols.name', sortable: true },
    { field: 'startDate', header: 'reviews.cycles.cols.period', sortable: true, width: '200px' },
    { field: 'status', header: 'reviews.cycles.cols.status', sortable: true, width: '110px' },
    { field: 'progress', header: 'reviews.cycles.cols.progress', width: '220px' },
    { field: 'actions', header: '', width: '220px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.reviews.getCycles().subscribe({
      next: cycles => {
        this.cycles.set(cycles);
        this.loading.set(false);
        const id = this.selectedId();
        if (id) this.loadCycleReviews(id);
      },
      error: () => this.loading.set(false),
    });
  }

  protected select(row: unknown): void {
    const cycle = row as ReviewCycle;
    this.selectedId.set(cycle.id);
    this.loadCycleReviews(cycle.id);
  }

  private loadCycleReviews(id: number): void {
    this.reviews.getCycleReviews(id).subscribe({
      next: rows => this.cycleReviews.set(rows),
      error: () => this.cycleReviews.set([]),
    });
  }

  protected openDialog(cycle: ReviewCycle | null): void {
    this.dialog.open<ReviewCycleDialogComponent, ReviewCycle | null, ReviewCycle | null>(ReviewCycleDialogComponent, {
      width: '640px',
      data: cycle,
    }).afterClosed().subscribe(saved => {
      if (saved) this.load();
    });
  }

  protected launch(cycle: ReviewCycle): void {
    this.confirm('reviews.cycles.launchConfirmTitle', 'reviews.cycles.launchConfirm', cycle, 'info', () => {
      this.busy.set(true);
      this.reviews.launchCycle(cycle.id).subscribe({
        next: result => {
          this.busy.set(false);
          this.snackbar.success(this.translate.instant('reviews.cycles.launched', { count: result.reviewsCreated }));
          this.load();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.snackbar.errorFrom(err, 'reviews.cycles.launchFailed');
        },
      });
    });
  }

  protected close(cycle: ReviewCycle): void {
    this.confirm('reviews.cycles.closeConfirmTitle', 'reviews.cycles.closeConfirm', cycle, 'warn', () => {
      this.busy.set(true);
      this.reviews.closeCycle(cycle.id).subscribe({
        next: () => {
          this.busy.set(false);
          this.snackbar.success(this.translate.instant('reviews.cycles.closed'));
          this.load();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.snackbar.errorFrom(err, 'reviews.cycles.closeFailed');
        },
      });
    });
  }

  private confirm(titleKey: string, messageKey: string, cycle: ReviewCycle, severity: 'info' | 'warn', then: () => void): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant(titleKey),
        message: this.translate.instant(messageKey, { name: cycle.name }),
        severity,
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(ok => {
      if (ok) then();
    });
  }

  protected openReview(review: PerformanceReview): void {
    this.opened.emit(review);
  }
}
