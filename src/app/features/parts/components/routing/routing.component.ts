import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { PercentPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { Operation } from '../../models/operation.model';
import { BOMLine } from '../../models/bom-line.model';
import { OperationDialogComponent, OperationDialogData } from '../operation-dialog/operation-dialog.component';
import { RoutingFlowViewComponent } from '../routing-flow-view/routing-flow-view.component';
import { RoutingGraphEditorComponent } from '../routing-graph-editor/routing-graph-editor.component';
import { RoutingCopyDialogComponent, RoutingCopyDialogData } from '../routing-copy-dialog/routing-copy-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { STEP_GATING_MODES, StepGatingMode } from '../../../../shared/models/step-gating-mode.type';
import { describeConflicts, predecessorConflictsOf } from '../../utils/predecessor-conflicts.utils';
import { effectivePredecessors } from '../../utils/routing-predecessors.utils';

type RoutingViewMode = 'list' | 'flow';

@Component({
  selector: 'app-routing',
  standalone: true,
  imports: [EmptyStateComponent, LoadingBlockDirective, TranslatePipe, MatTooltipModule, RoutingFlowViewComponent, RoutingGraphEditorComponent, DragDropModule, DurationMsPipe, PercentPipe, ReactiveFormsModule, SelectComponent],
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
  private readonly auth = inject(AuthService);

  readonly partId = input.required<number>();
  readonly bomLines = input<BOMLine[]>([]);
  readonly stepGating = input<StepGatingMode | null>(null);

  protected readonly operations = signal<Operation[]>([]);
  protected readonly loading = signal(false);
  protected readonly routingViewMode = signal<RoutingViewMode>('list');
  protected readonly expandedInstructions = signal<ReadonlySet<number>>(new Set());
  protected readonly totalCycleMs = computed(() =>
    this.operations().reduce((sum, op) => sum + (op.estimatedMs ?? 0), 0));
  protected readonly totalSetupMs = computed(() =>
    this.operations().reduce((sum, op) => sum + (op.setupMinutes ?? 0), 0) * 60_000);
  protected readonly totalLotMs = computed(() =>
    this.operations().reduce((sum, op) => sum + (op.runMinutesLot ?? 0), 0) * 60_000);
  protected readonly followsByOperation = computed(() => {
    const labels = new Map<number, string>();
    for (const [id, links] of effectivePredecessors(this.operations())) {
      if (links.length === 0 || links.every(link => link.implicit)) continue;
      labels.set(id, links.map(link => link.gate === 'Complete'
        ? this.translate.instant('parts.followsDone', { step: link.stepNumber })
        : `Op ${link.stepNumber}`).join(', '));
    }
    return labels;
  });

  protected readonly canEditGating = this.auth.hasAnyRole(['Admin', 'Manager', 'Engineer']);
  protected readonly canEditFlow = this.canEditGating;
  protected readonly flowDirty = signal(false);
  protected readonly gatingControl = new FormControl<StepGatingMode | null>({ value: null, disabled: !this.canEditGating });
  protected readonly gatingOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('parts.stepGatingDefault') },
    ...STEP_GATING_MODES.map(mode => ({ value: mode, label: this.translate.instant(`parts.stepGatingModes.${mode}`) })),
  ];
  private savedGating: StepGatingMode | null = null;

  private readonly syncGating = effect(() => {
    const value = this.stepGating();
    this.savedGating = value;
    this.gatingControl.setValue(value, { emitEvent: false });
  });

  private readonly saveGating = this.gatingControl.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(value => {
      if (value === this.savedGating) return;
      this.partsService.updateStepGating(this.partId(), value).subscribe({
        next: () => {
          this.savedGating = value;
          this.snackbar.success(this.translate.instant('parts.stepGatingSaved'));
        },
        error: (err: unknown) => {
          this.gatingControl.setValue(this.savedGating, { emitEvent: false });
          this.snackbar.errorFrom(err, 'parts.stepGatingSaveFailed');
        },
      });
    });

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

  protected showView(mode: RoutingViewMode): void {
    if (mode === this.routingViewMode()) return;
    if (!this.flowDirty()) {
      this.routingViewMode.set(mode);
      return;
    }
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('routingGraph.leaveTitle'),
        message: this.translate.instant('routingGraph.leaveMessage'),
        confirmLabel: this.translate.instant('routingGraph.leaveConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.flowDirty.set(false);
      this.routingViewMode.set(mode);
    });
  }

  protected onFlowSaved(operations: Operation[]): void {
    this.operations.set([...operations].sort((a, b) => a.stepNumber - b.stepNumber));
  }

  protected toggleInstructions(operationId: number): void {
    this.expandedInstructions.update(ids => {
      const next = new Set(ids);
      if (!next.delete(operationId)) next.add(operationId);
      return next;
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

  protected openCopyRouting(): void {
    this.dialog.open(RoutingCopyDialogComponent, {
      width: '480px',
      data: { partId: this.partId() } satisfies RoutingCopyDialogData,
    }).afterClosed().subscribe((result: Operation[] | null | undefined) => {
      if (result) {
        this.operations.set([...result].sort((a, b) => a.stepNumber - b.stepNumber));
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
        this.snackbar.success(this.translate.instant('parts.operationUpdated'));
        this.loadOperations();
      }
    });
  }

  protected onReorderOperation(event: CdkDragDrop<Operation[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const numbers = this.operations().map(op => op.stepNumber).sort((a, b) => a - b);
    const reordered = [...this.operations()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.operations.set(reordered.map((op, index) => ({ ...op, stepNumber: numbers[index] })));
    this.saveOrder(reordered.map(op => op.id), false);
  }

  private saveOrder(operationIds: number[], removeConflictingPredecessors: boolean): void {
    this.partsService.reorderOperations(this.partId(), { operationIds, removeConflictingPredecessors }).subscribe({
      next: (operations) => {
        this.operations.set([...operations].sort((a, b) => a.stepNumber - b.stepNumber));
        this.snackbar.success(this.translate.instant('parts.operationReordered'));
      },
      error: (err: unknown) => {
        const conflicts = predecessorConflictsOf(err);
        if (!conflicts) {
          this.snackbar.errorFrom(err, 'parts.operationReorderFailed');
          this.loadOperations();
          return;
        }
        this.dialog.open(ConfirmDialogComponent, {
          width: '440px',
          data: {
            title: this.translate.instant('parts.predecessorConflictTitle'),
            message: this.translate.instant('parts.predecessorConflictMessage', { links: describeConflicts(conflicts) }),
            confirmLabel: this.translate.instant('parts.predecessorConflictConfirm'),
            severity: 'warn',
          } satisfies ConfirmDialogData,
        }).afterClosed().subscribe(confirmed => {
          if (confirmed) this.saveOrder(operationIds, true);
          else this.loadOperations();
        });
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
        this.snackbar.success(this.translate.instant('parts.operationDeleted'));
        this.loadOperations();
      });
    });
  }
}
