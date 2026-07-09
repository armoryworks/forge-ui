import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerSegmentService } from '../../services/customer-segment.service';
import { CustomerSegment } from '../../models/customer-segment.model';
import {
  CustomerSegmentDialogComponent,
  CustomerSegmentDialogData,
  CustomerSegmentDialogResult,
} from './customer-segment-dialog/customer-segment-dialog.component';

/**
 * Customer segments — saved named filters reused across reports, campaigns, and dashboards.
 * Real CRUD against the CustomerSegment backend (C3). A visual filter-builder is a future
 * enhancement; the criteria is authored/edited as text for now.
 */
@Component({
  selector: 'app-customer-segments-page',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, EmptyStateComponent],
  templateUrl: './customer-segments.component.html',
  styleUrl: './customer-segments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerSegmentsPageComponent {
  private readonly service = inject(CustomerSegmentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly segments = signal<CustomerSegment[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getSegments().subscribe({
      next: (s) => { this.segments.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    this.openDialog(null);
  }

  protected edit(segment: CustomerSegment): void {
    this.openDialog(segment);
  }

  private openDialog(segment: CustomerSegment | null): void {
    this.dialog.open<CustomerSegmentDialogComponent, CustomerSegmentDialogData, CustomerSegmentDialogResult>(
      CustomerSegmentDialogComponent,
      { width: '520px', autoFocus: false, data: { segment } },
    ).afterClosed().subscribe(result => {
      if (result) this.load();
    });
  }

  protected remove(segment: CustomerSegment): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.segmentsPage.deleteTitle'),
        message: this.translate.instant('customers.segmentsPage.deleteMessage', { name: segment.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.deleteSegment(segment.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('customers.segmentsPage.deleted'));
          this.load();
        },
      });
    });
  }
}
