import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';

import { PerformanceReview } from '../../models/performance-review.model';
import { reviewStage } from '../../models/review-stage.util';

type ReviewRow = PerformanceReview & { stage: string };

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [TranslatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './review-list.component.html',
  styleUrl: './review-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewListComponent {
  readonly reviews = input.required<PerformanceReview[]>();
  readonly tableId = input.required<string>();
  readonly showEmployee = input(true);
  readonly showReviewer = input(true);
  readonly emptyMessage = input('');
  readonly opened = output<PerformanceReview>();

  protected readonly rows = computed<ReviewRow[]>(() =>
    this.reviews().map(r => ({ ...r, stage: reviewStage(r.status) })));

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'cycleName', header: 'reviews.cols.cycle', sortable: true },
    ...(this.showEmployee() ? [{ field: 'employeeName', header: 'reviews.cols.employee', sortable: true }] : []),
    ...(this.showReviewer() ? [{ field: 'reviewerName', header: 'reviews.cols.reviewer', sortable: true }] : []),
    { field: 'stage', header: 'reviews.cols.status', sortable: true, width: '170px' },
    { field: 'overallRating', header: 'reviews.cols.rating', sortable: true, width: '90px', align: 'right' as const },
  ]);

  protected open(row: unknown): void {
    this.opened.emit(row as PerformanceReview);
  }
}
