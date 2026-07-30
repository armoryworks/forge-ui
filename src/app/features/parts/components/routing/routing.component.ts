import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { forkJoin } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { Operation } from '../../models/operation.model';
import { BOMLine } from '../../models/bom-line.model';
import { OperationDialogComponent, OperationDialogData } from '../operation-dialog/operation-dialog.component';
import { RoutingFlowViewComponent } from '../routing-flow-view/routing-flow-view.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

type RoutingViewMode = 'list' | 'flow';

@Component({
  selector: 'app-routing',
  standalone: true,
  imports: [EmptyStateComponent, LoadingBlockDirective, TranslatePipe, MatTooltipModule, RoutingFlowViewComponent, DragDropModule],
  templateUrl: './routing.component.html',
  styleUrl: './routing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingComponent implements OnInit {
  private readonly partsService = inject(PartsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly draftResume = inject(DraftResumeService);

  readonly partId = input.required<number>();
  readonly bomLines = input<BOMLine[]>([]);

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

  ngOnInit(): void {
    // Resume a new-Operation draft: when the part detail deep-linked here with
    // ?resumeDraft=operation:new, reopen the operation create dialog. consume()
    // returns true once then strips the param so a refresh won't reopen it.
    if (this.draftResume.consume('operation')) {
      this.openAddOperation();
    }
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
        bomLines: this.bomLines(),
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
        bomLines: this.bomLines(),
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

  // Drag-reorder of routing steps. There is no bulk reorder endpoint, so we
  // renumber optimistically and PATCH each operation whose stepNumber changed —
  // the same per-item persistence the kanban board uses for card positions.
  protected onReorderOperation(event: CdkDragDrop<Operation[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const previousStepById = new Map(this.operations().map(op => [op.id, op.stepNumber]));

    const reordered = [...this.operations()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    const renumbered = reordered.map((op, index) => ({ ...op, stepNumber: index + 1 }));

    // Apply the new order immediately for a responsive feel.
    this.operations.set(renumbered);

    const changed = renumbered.filter(op => previousStepById.get(op.id) !== op.stepNumber);
    if (changed.length === 0) return;

    forkJoin(
      changed.map(op => this.partsService.updateOperation(this.partId(), op.id, { stepNumber: op.stepNumber })),
    ).subscribe({
      next: () => this.snackbar.success(this.translate.instant('parts.operationReordered')),
      error: () => {
        // Re-sync from the server so the UI can't drift from persisted order.
        this.snackbar.error(this.translate.instant('parts.operationReorderFailed'));
        this.loadOperations();
      },
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
