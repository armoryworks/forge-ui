import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { SalesOrderStage, SalesOrderStages } from '../../models/sales-order-stage.model';
import { StageDialogComponent } from '../stage-dialog/stage-dialog.component';
import { StageLinesDialogComponent } from '../stage-lines-dialog/stage-lines-dialog.component';

const LOCKED_STATUSES = ['Shipped', 'Closed'];

/**
 * The staged schedule of a sales order (S4c): activate it, add, edit and delete stages, split line quantities
 * across them, then mark each ready and ship it. A shipped stage is locked.
 */
@Component({
  selector: 'app-sales-order-stages-tab',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, EmptyStateComponent, LoadingBlockDirective, StageDialogComponent, StageLinesDialogComponent],
  templateUrl: './sales-order-stages-tab.component.html',
  styleUrl: './sales-order-stages-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrderStagesTabComponent implements OnInit {
  private readonly soService = inject(SalesOrderService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly salesOrderId = input.required<number>();
  readonly lines = input.required<SalesOrderLine[]>();
  readonly shipped = output<void>();

  protected readonly stages = signal<SalesOrderStages | null>(null);
  protected readonly loading = signal(false);
  protected readonly editing = signal<SalesOrderStage | 'new' | null>(null);
  protected readonly assigning = signal<SalesOrderStage | null>(null);

  protected readonly nextSequence = computed(() =>
    (this.stages()?.stages ?? []).reduce((max, s) => Math.max(max, s.sequence), 0) + 1);
  protected readonly editingStage = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.soService.getStages(this.salesOrderId()).subscribe({
      next: s => { this.stages.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected isLocked(stage: SalesOrderStage): boolean {
    return LOCKED_STATUSES.includes(stage.status);
  }

  protected activate(): void {
    this.loading.set(true);
    this.soService.activateStagedSchedule(this.salesOrderId()).subscribe({
      next: s => {
        this.stages.set(s);
        this.loading.set(false);
        this.snackbar.success(this.translate.instant('salesOrders.stages.activated'));
      },
      error: () => this.loading.set(false),
    });
  }

  protected onStageSaved(): void {
    this.editing.set(null);
    this.load();
  }

  protected onLinesSaved(): void {
    this.assigning.set(null);
    this.load();
  }

  protected deleteStage(stage: SalesOrderStage): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrderEngines.stages.deleteTitle'),
        message: this.translate.instant('salesOrderEngines.stages.deleteMessage', { name: stage.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.soService.deleteStage(stage.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('salesOrderEngines.stages.deleted', { name: stage.name }));
          this.load();
        },
      });
    });
  }

  protected completeStage(stageId: number): void {
    this.soService.completeStage(stageId).subscribe({ next: () => this.load() });
  }

  protected shipStage(stageId: number): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.stages.shipTitle'),
        message: this.translate.instant('salesOrders.stages.shipMessage'),
        confirmLabel: this.translate.instant('salesOrders.stages.ship'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.soService.shipStage(stageId).subscribe({
        next: () => { this.load(); this.shipped.emit(); },
      });
    });
  }

  protected stageStatusClass(status: string): string {
    const map: Record<string, string> = {
      Planned: 'chip--muted', InProduction: 'chip--info', ReadyToShip: 'chip--warning',
      Shipped: 'chip--success', Closed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }
}
