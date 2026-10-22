import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { Operation } from '../../models/operation.model';
import { RoutingDraftConflict } from '../../models/routing-draft-conflict.model';
import { RoutingDraftResult } from '../../models/routing-draft-result.model';
import { RoutingDraftStep } from '../../models/routing-draft-step.model';
import { RoutingGraph } from '../../models/routing-graph.model';
import { RoutingGraphIssue } from '../../models/routing-graph-issue.model';
import { PartsService } from '../../services/parts.service';
import {
  connectSteps, disconnectSteps, draftConflicts, draftFromOperations, draftRequest, draftSignature, moveStep,
  removeConflicts, reorderSteps, runAfterPrevious, runAlongside, setLinkGate, sortDraft,
} from '../../utils/routing-graph-draft.utils';
import { isRoutingGraphStale, routingGraphIssuesOf } from '../../utils/routing-graph-errors.utils';
import {
  ROUTING_NODE_HEIGHT, ROUTING_NODE_WIDTH, connectorPath, nodeAt, routingGraphLayout,
} from '../../utils/routing-graph-layout.utils';

interface PointerDrag {
  mode: 'connect' | 'lane';
  fromId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

interface LinkRow {
  key: string;
  toId: number;
  fromId: number;
  label: string;
  implicit: boolean;
  waitsForDone: boolean;
}

const DRAG_THRESHOLD_PX = 6;

@Component({
  selector: 'app-routing-graph-editor',
  standalone: true,
  imports: [
    TranslatePipe, MatTooltipModule, DragDropModule, ReactiveFormsModule,
    SelectComponent, ValidationButtonComponent, EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './routing-graph-editor.component.html',
  styleUrl: './routing-graph-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'cancelConnect()' },
})
export class RoutingGraphEditorComponent {
  private readonly partsService = inject(PartsService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly partId = input.required<number>();
  readonly saved = output<Operation[]>();
  readonly dirtyChange = output<boolean>();

  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  protected readonly nodeWidth = ROUTING_NODE_WIDTH;
  protected readonly nodeHeight = ROUTING_NODE_HEIGHT;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly version = signal<string | null>(null);
  protected readonly original = signal<RoutingDraftStep[]>([]);
  protected readonly draft = signal<RoutingDraftStep[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly connectFromId = signal<number | null>(null);
  protected readonly drag = signal<PointerDrag | null>(null);
  protected readonly serverIssues = signal<RoutingGraphIssue[]>([]);
  protected readonly announcement = signal('');

  protected readonly ordered = computed(() => sortDraft(this.draft()));
  protected readonly layout = computed(() => routingGraphLayout(this.draft()));
  protected readonly conflicts = computed(() => draftConflicts(this.draft()));
  protected readonly dirty = computed(() => draftSignature(this.draft()) !== draftSignature(this.original()));
  protected readonly selected = computed(() => this.draft().find(step => step.id === this.selectedId()) ?? null);
  protected readonly connectFrom = computed(() => this.draft().find(step => step.id === this.connectFromId()) ?? null);

  protected readonly selectedIndex = computed(() => this.ordered().findIndex(step => step.id === this.selectedId()));

  protected readonly linkRows = computed<LinkRow[]>(() => {
    const byId = new Map(this.draft().map(step => [step.id, step]));
    return this.layout().edges
      .filter(edge => !edge.conflict)
      .map(edge => ({
        key: edge.key,
        toId: edge.toId,
        fromId: edge.fromId,
        label: this.translate.instant('routingGraph.linkLabel', {
          step: edge.toStep, title: byId.get(edge.toId)?.title ?? '', predecessor: edge.fromStep,
        }),
        implicit: edge.implicit,
        waitsForDone: edge.gate === 'Complete',
      }));
  });

  protected readonly conflictRows = computed(() => this.conflicts().map(conflict => ({
    conflict,
    label: this.translate.instant('routingGraph.conflictLabel', {
      step: conflict.stepNumber, predecessor: conflict.predecessorStepNumber ?? '?',
    }),
  })));

  protected readonly issueMessages = computed(() => this.serverIssues().map(issue =>
    this.translate.instant(`routingGraph.issues.${issue.kind}`, {
      step: issue.stepNumber ?? '?', predecessor: issue.predecessorStepNumber ?? '?',
    })));

  protected readonly dragPath = computed(() => {
    const drag = this.drag();
    if (drag?.mode !== 'connect') return null;
    const from = this.layout().nodes.find(node => node.step.id === drag.fromId);
    return from ? connectorPath(from.x + ROUTING_NODE_WIDTH, from.y + ROUTING_NODE_HEIGHT / 2, drag.x, drag.y) : null;
  });

  protected readonly stepOptions = computed<SelectOption[]>(() => this.ordered().map(step => ({
    value: step.id,
    label: this.translate.instant('routingGraph.stepOption', { step: step.stepNumber, title: step.title }),
  })));

  protected readonly addLinkForm = new FormGroup({
    stepId: new FormControl<number | null>(null, Validators.required),
    predecessorId: new FormControl<number | null>(null, Validators.required),
  });
  private readonly addLinkValue = toSignal(this.addLinkForm.valueChanges, { initialValue: this.addLinkForm.value });
  protected readonly predecessorOptions = computed<SelectOption[]>(() => {
    const step = this.draft().find(s => s.id === this.addLinkValue().stepId);
    return this.stepOptions().filter(option => step !== undefined
      && this.draft().some(s => s.id === option.value && s.stepNumber < step.stepNumber));
  });

  protected readonly violations = computed(() => this.conflicts().length > 0
    ? [this.translate.instant('routingGraph.conflictsBlockSave', { count: this.conflicts().length })]
    : []);

  constructor() {
    effect(() => {
      const id = this.partId();
      if (id) this.load(id);
    });
    effect(() => this.dirtyChange.emit(this.dirty()));
  }

  protected load(partId = this.partId()): void {
    this.loading.set(true);
    this.partsService.getRoutingGraph(partId).subscribe({
      next: graph => {
        this.apply(graph);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'routingGraph.loadFailed');
      },
    });
  }

  protected selectNode(id: number): void {
    const from = this.connectFromId();
    if (from !== null && from !== id) {
      this.connectFromId.set(null);
      this.update(connectSteps(this.draft(), from, id), 'routingGraph.announce.connected', id, from);
      return;
    }
    this.connectFromId.set(null);
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  protected startConnect(id: number): void {
    this.connectFromId.set(id);
    const step = this.draft().find(s => s.id === id);
    this.announce('routingGraph.announce.pickTarget', { step: step?.stepNumber ?? '' });
  }

  protected cancelConnect(): void {
    if (this.connectFromId() === null && this.drag() === null) return;
    this.connectFromId.set(null);
    this.drag.set(null);
    this.announce('routingGraph.announce.cancelled');
  }

  protected disconnect(toId: number, fromId: number): void {
    this.update(disconnectSteps(this.draft(), toId, fromId), 'routingGraph.announce.disconnected', toId, fromId);
  }

  protected toggleGate(row: LinkRow): void {
    const gate = row.waitsForDone ? 'Quantity' : 'Complete';
    this.update(setLinkGate(this.draft(), row.toId, row.fromId, gate),
      gate === 'Complete' ? 'routingGraph.announce.waitsForDone' : 'routingGraph.announce.waitsForPieces', row.toId, row.fromId);
  }

  protected runParallel(id: number): void {
    const ordered = this.ordered();
    const index = ordered.findIndex(step => step.id === id);
    if (index <= 0) {
      this.announceError('firstStep');
      return;
    }
    this.update(runAlongside(this.draft(), id, ordered[index - 1].id), 'routingGraph.announce.parallel', id, ordered[index - 1].id);
  }

  protected runSequential(id: number): void {
    this.update(runAfterPrevious(this.draft(), id), 'routingGraph.announce.sequential', id, id);
  }

  protected move(id: number, delta: number): void {
    this.draft.set(moveStep(this.draft(), id, delta));
    this.serverIssues.set([]);
    const step = this.draft().find(s => s.id === id);
    this.announce('routingGraph.announce.moved', { step: step?.stepNumber ?? '', title: step?.title ?? '' });
  }

  protected onReorder(event: CdkDragDrop<RoutingDraftStep[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const ids = this.ordered().map(step => step.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.draft.set(reorderSteps(this.draft(), ids));
    this.serverIssues.set([]);
  }

  protected removeConflict(conflict: RoutingDraftConflict): void {
    this.draft.set(removeConflicts(this.draft(), [conflict]));
  }

  protected removeAllConflicts(): void {
    this.draft.set(removeConflicts(this.draft(), this.conflicts()));
  }

  protected addLink(): void {
    const { stepId, predecessorId } = this.addLinkForm.getRawValue();
    if (stepId === null || predecessorId === null) return;
    this.update(connectSteps(this.draft(), predecessorId, stepId), 'routingGraph.announce.connected', stepId, predecessorId);
    this.addLinkForm.controls.predecessorId.reset(null);
  }

  protected onPointerDown(event: PointerEvent, id: number, mode: PointerDrag['mode']): void {
    if (event.button !== 0) return;
    const point = this.pointFor(event);
    if (point === null) return;
    this.drag.set({ mode, fromId: id, startX: point.x, startY: point.y, x: point.x, y: point.y });
    if (mode === 'connect') event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag();
    const point = this.pointFor(event);
    if (drag === null || point === null) return;
    this.drag.set({ ...drag, x: point.x, y: point.y });
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag();
    const point = this.pointFor(event) ?? (drag ? { x: drag.x, y: drag.y } : null);
    this.drag.set(null);
    if (drag === null || point === null) return;
    this.dropAt(drag, point.x, point.y);
  }

  protected dropAt(drag: PointerDrag, x: number, y: number): void {
    const moved = Math.hypot(x - drag.startX, y - drag.startY) >= DRAG_THRESHOLD_PX;
    const target = nodeAt(this.layout(), x, y);
    if (!moved || target === null || target.step.id === drag.fromId) return;
    if (drag.mode === 'connect') {
      this.update(connectSteps(this.draft(), drag.fromId, target.step.id), 'routingGraph.announce.connected', target.step.id, drag.fromId);
    } else {
      this.update(runAlongside(this.draft(), drag.fromId, target.step.id), 'routingGraph.announce.alongside', drag.fromId, target.step.id);
    }
  }

  protected discard(): void {
    this.draft.set(this.original());
    this.serverIssues.set([]);
    this.connectFromId.set(null);
    this.announce('routingGraph.announce.discarded');
  }

  protected save(): void {
    if (this.conflicts().length > 0 || this.saving()) return;
    this.saving.set(true);
    this.serverIssues.set([]);
    this.partsService.updateRoutingGraph(this.partId(), { version: this.version(), steps: draftRequest(this.draft()) }).subscribe({
      next: graph => {
        this.saving.set(false);
        this.apply(graph);
        this.saved.emit(graph.operations);
        this.snackbar.success(this.translate.instant('routingGraph.saved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const issues = routingGraphIssuesOf(err);
        if (issues) {
          this.serverIssues.set(issues);
          return;
        }
        if (isRoutingGraphStale(err)) {
          this.confirmReload();
          return;
        }
        this.snackbar.errorFrom(err, 'routingGraph.saveFailed');
      },
    });
  }

  private confirmReload(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('routingGraph.staleTitle'),
        message: this.translate.instant('routingGraph.staleMessage'),
        confirmLabel: this.translate.instant('routingGraph.staleConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.load();
    });
  }

  private apply(graph: RoutingGraph): void {
    const draft = draftFromOperations(graph.operations);
    this.version.set(graph.version);
    this.original.set(draft);
    this.draft.set(draft);
    if (!draft.some(step => step.id === this.selectedId())) this.selectedId.set(null);
  }

  private update(result: RoutingDraftResult, key: string, toId: number, fromId: number): void {
    if (result.error !== null) {
      this.announceError(result.error, toId, fromId);
      return;
    }
    this.draft.set(result.draft);
    this.serverIssues.set([]);
    const byId = new Map(result.draft.map(step => [step.id, step]));
    this.announce(key, { step: byId.get(toId)?.stepNumber ?? '', predecessor: byId.get(fromId)?.stepNumber ?? '' });
  }

  private announceError(error: string, toId?: number, fromId?: number): void {
    const byId = new Map(this.draft().map(step => [step.id, step]));
    const message = this.translate.instant(`routingGraph.errors.${error}`, {
      step: toId !== undefined ? byId.get(toId)?.stepNumber ?? '' : '',
      predecessor: fromId !== undefined ? byId.get(fromId)?.stepNumber ?? '' : '',
    });
    this.announcement.set(message);
    this.snackbar.info(message);
  }

  private announce(key: string, params: Record<string, unknown> = {}): void {
    this.announcement.set(this.translate.instant(key, params));
  }

  private pointFor(event: PointerEvent): { x: number; y: number } | null {
    const element = this.canvas()?.nativeElement;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
