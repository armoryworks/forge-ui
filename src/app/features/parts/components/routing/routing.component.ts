import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { Operation } from '../../models/operation.model';
import { BOMEntry } from '../../models/bom-entry.model';
import { OperationDialogComponent, OperationDialogData } from '../operation-dialog/operation-dialog.component';
import { RoutingFlowViewComponent } from '../routing-flow-view/routing-flow-view.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

type RoutingViewMode = 'list' | 'flow';

@Component({
  selector: 'app-routing',
  standalone: true,
  imports: [EmptyStateComponent, LoadingBlockDirective, TranslatePipe, MatTooltipModule, RoutingFlowViewComponent],
  templateUrl: './routing.component.html',
  styleUrl: './routing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingComponent {
  private readonly partsService = inject(PartsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly partId = input.required<number>();
  readonly bomEntries = input<BOMEntry[]>([]);

  protected readonly operations = signal<Operation[]>([]);
  protected readonly loading = signal(false);
  protected readonly routingViewMode = signal<RoutingViewMode>('list');

  constructor() {
    effect(() => {
      const id = this.partId();
      if (id) {
        this.loadOperations(id);
      }
    });
  }

  private loadOperations(partId?: number): void {
    const id = partId ?? this.partId();
    this.loading.set(true);
    this.partsService.getOperations(id).subscribe({
      next: (operations) => {
        this.operations.set(operations);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openAddOperation(): void {
    this.dialog.open(OperationDialogComponent, {
      width: '800px',
      data: {
        partId: this.partId(),
        nextStepNumber: this.operations().length + 1,
        operations: this.operations(),
        bomEntries: this.bomEntries(),
      } satisfies OperationDialogData,
    }).afterClosed().subscribe((result: Operation | undefined) => {
      if (result) {
        this.operations.update(list => [...list, result].sort((a, b) => a.stepNumber - b.stepNumber));
        this.snackbar.success(this.translate.instant('parts.operationAdded'));
      }
    });
  }

  protected openEditOperation(operation: Operation): void {
    this.dialog.open(OperationDialogComponent, {
      width: '800px',
      data: {
        partId: this.partId(),
        operation,
        operations: this.operations(),
        bomEntries: this.bomEntries(),
      } satisfies OperationDialogData,
    }).afterClosed().subscribe((result: Operation | undefined) => {
      if (result) {
        this.operations.update(list =>
          list.map(s => s.id === result.id ? result : s).sort((a, b) => a.stepNumber - b.stepNumber),
        );
        this.snackbar.success(this.translate.instant('parts.operationUpdated'));
      }
    });
  }

  protected deleteOperation(operation: Operation): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.deleteOperation'),
        message: this.translate.instant('parts.deleteOperationMessage', { stepNumber: operation.stepNumber, title: operation.title }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.deleteOperation(this.partId(), operation.id).subscribe(() => {
        this.operations.update(list => list.filter(s => s.id !== operation.id));
        this.snackbar.success(this.translate.instant('parts.operationDeleted'));
      });
    });
  }
}
