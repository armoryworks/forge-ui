import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { RoutingGraphEditorComponent } from './routing-graph-editor.component';
import { PartsService } from '../../services/parts.service';
import { Operation } from '../../models/operation.model';
import { RoutingDraftStep } from '../../models/routing-draft-step.model';
import { RoutingGraph } from '../../models/routing-graph.model';
import { RoutingGraphIssue } from '../../models/routing-graph-issue.model';
import { UpdateRoutingGraphRequest } from '../../models/update-routing-graph-request.model';
import { RoutingGraphLayout } from '../../models/routing-graph-layout.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface Drag { mode: 'connect' | 'lane'; fromId: number; startX: number; startY: number; x: number; y: number }

interface EditorInternals {
  draft(): RoutingDraftStep[];
  dirty(): boolean;
  conflicts(): unknown[];
  layout(): RoutingGraphLayout;
  connectFromId(): number | null;
  selectedId(): number | null;
  serverIssues(): RoutingGraphIssue[];
  announcement(): string;
  version(): string | null;
  load(partId?: number): void;
  selectNode(id: number): void;
  startConnect(id: number): void;
  cancelConnect(): void;
  runParallel(id: number): void;
  move(id: number, delta: number): void;
  removeAllConflicts(): void;
  discard(): void;
  save(): void;
  dropAt(drag: Drag, x: number, y: number): void;
  addLinkForm: { setValue(value: { stepId: number | null; predecessorId: number | null }): void };
  addLink(): void;
  saved: { subscribe(fn: (ops: Operation[]) => void): void };
}

function operation(id: number, stepNumber: number, predecessors: number[] = []): Operation {
  return {
    id, partId: 7, stepNumber, title: `Step ${stepNumber}`, instructions: null,
    workCenterId: null, workCenterName: null, estimatedMs: null, setupMinutes: 0, runMinutesLot: 0,
    isQcCheckpoint: false, qcCriteria: null, referencedOperationId: null, referencedOperationTitle: null,
    materials: [], createdAt: new Date(), updatedAt: new Date(),
    isSubcontract: false, subcontractVendorId: null, subcontractVendorName: null, subcontractTurnTimeDays: null,
    scrapFactor: 0,
    predecessors: predecessors.map(p => ({ operationId: p, stepNumber: p * 10, gate: 'Quantity' as const })),
  };
}

const GRAPH: RoutingGraph = { version: 'v1', operations: [operation(1, 10), operation(2, 20), operation(3, 30), operation(4, 40)] };

function setup(parts: Record<string, unknown> = {}, dialogResult = true) {
  const snackbar = { success: vi.fn(), errorFrom: vi.fn(), info: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  const service = {
    getRoutingGraph: vi.fn(() => of(GRAPH)),
    updateRoutingGraph: vi.fn((_: number, request: UpdateRoutingGraphRequest) => of({
      version: 'v2',
      operations: request.steps.map(s => operation(s.operationId, s.stepNumber, s.predecessors.map(p => p.operationId))),
    })),
    ...parts,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: PartsService, useValue: service },
      { provide: SnackbarService, useValue: snackbar },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new RoutingGraphEditorComponent());
  Object.defineProperty(component, 'partId', { value: () => 7 });
  const editor = component as unknown as EditorInternals;
  editor.load();
  return { editor, service, snackbar, dialog };
}

function follows(editor: EditorInternals, id: number): number[] {
  return editor.draft().find(s => s.id === id)!.predecessors.map(p => p.operationId);
}

describe('RoutingGraphEditorComponent — keyboard connect', () => {
  it('selecting a step, choosing connect, then activating a later step links them', () => {
    const { editor } = setup();

    editor.selectNode(1);
    editor.startConnect(1);
    expect(editor.connectFromId()).toBe(1);
    editor.selectNode(4);

    expect(editor.connectFromId()).toBeNull();
    expect(follows(editor, 4)).toEqual([3, 1]);
    expect(editor.dirty()).toBe(true);
    expect(editor.announcement()).toBe('routingGraph.announce.connected');
  });

  it('connecting backwards is refused and explained, and Escape leaves connect mode', () => {
    const { editor, snackbar } = setup();

    editor.startConnect(3);
    editor.selectNode(2);
    expect(snackbar.info).toHaveBeenCalledWith('routingGraph.errors.order');
    expect(editor.dirty()).toBe(false);

    editor.startConnect(3);
    editor.cancelConnect();
    expect(editor.connectFromId()).toBeNull();
  });

  it('the add-link form connects the chosen steps', () => {
    const { editor } = setup();

    editor.addLinkForm.setValue({ stepId: 3, predecessorId: 1 });
    editor.addLink();

    expect(follows(editor, 3)).toEqual([2, 1]);
  });

  it('runs a step alongside the step before it', () => {
    const { editor } = setup();

    editor.runParallel(3);

    expect(follows(editor, 3)).toEqual([1]);
  });
});

describe('RoutingGraphEditorComponent — drag', () => {
  function centreOf(editor: EditorInternals, id: number): { x: number; y: number } {
    const node = editor.layout().nodes.find(n => n.step.id === id)!;
    return { x: node.x + 10, y: node.y + 10 };
  }

  it('dropping the arrow of a step on a later step connects them', () => {
    const { editor } = setup();
    const target = centreOf(editor, 4);

    editor.dropAt({ mode: 'connect', fromId: 2, startX: 0, startY: 0, x: target.x, y: target.y }, target.x, target.y);

    expect(follows(editor, 4)).toEqual([3, 2]);
  });

  it('dropping a step on another runs it in that step\'s lane', () => {
    const { editor } = setup();
    const target = centreOf(editor, 2);

    editor.dropAt({ mode: 'lane', fromId: 3, startX: 0, startY: 0, x: target.x, y: target.y }, target.x, target.y);

    expect(follows(editor, 3)).toEqual([1]);
    const lanes = new Map(editor.layout().nodes.map(n => [n.step.id, n.column]));
    expect(lanes.get(2)).toBe(lanes.get(3));
  });

  it('a press without movement changes nothing', () => {
    const { editor } = setup();
    const target = centreOf(editor, 4);

    editor.dropAt({ mode: 'connect', fromId: 1, startX: target.x, startY: target.y, x: target.x, y: target.y }, target.x + 1, target.y);

    expect(editor.dirty()).toBe(false);
  });
});

describe('RoutingGraphEditorComponent — save', () => {
  it('saves the whole graph with the version it loaded and reports the saved operations', () => {
    const { editor, service, snackbar } = setup();
    const saved = vi.fn();
    editor.saved.subscribe(saved);
    editor.runParallel(3);

    editor.save();

    expect(service.updateRoutingGraph).toHaveBeenCalledWith(7, {
      version: 'v1',
      steps: [
        { operationId: 1, stepNumber: 10, predecessors: [] },
        { operationId: 2, stepNumber: 20, predecessors: [] },
        { operationId: 3, stepNumber: 30, predecessors: [{ operationId: 1, gate: 'Quantity' }] },
        { operationId: 4, stepNumber: 40, predecessors: [{ operationId: 3, gate: 'Quantity' }, { operationId: 2, gate: 'Quantity' }] },
      ],
    });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(editor.version()).toBe('v2');
    expect(editor.dirty()).toBe(false);
    expect(snackbar.success).toHaveBeenCalledWith('routingGraph.saved');
  });

  it('a reorder that breaks a link blocks the save until the link is removed', () => {
    const { editor, service } = setup();
    editor.addLinkForm.setValue({ stepId: 3, predecessorId: 1 });
    editor.addLink();
    editor.move(1, 3);

    expect(editor.conflicts()).toHaveLength(1);
    editor.save();
    expect(service.updateRoutingGraph).not.toHaveBeenCalled();

    editor.removeAllConflicts();
    editor.save();
    expect(service.updateRoutingGraph).toHaveBeenCalledTimes(1);
  });

  it('shows the server\'s graph problems and keeps the draft', () => {
    const issues: RoutingGraphIssue[] = [
      { kind: 'PredecessorNotEarlier', operationId: 3, stepNumber: 30, predecessorOperationId: 4, predecessorStepNumber: 40 },
    ];
    const { editor } = setup({
      updateRoutingGraph: vi.fn(() => throwError(() => new HttpErrorResponse({
        status: 422, error: { code: 'routing-graph-invalid', issues },
      }))),
    });
    editor.runParallel(3);

    editor.save();

    expect(editor.serverIssues()).toEqual(issues);
    expect(editor.dirty()).toBe(true);
  });

  it('a stale version asks to reload and reloads on confirm', () => {
    const { editor, service, dialog } = setup({
      updateRoutingGraph: vi.fn(() => throwError(() => new HttpErrorResponse({
        status: 409, error: { code: 'routing-graph-stale', version: 'v9' },
      }))),
    });
    editor.runParallel(3);

    editor.save();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(service.getRoutingGraph).toHaveBeenCalledTimes(2);
    expect(editor.dirty()).toBe(false);
  });

  it('discard puts the loaded graph back', () => {
    const { editor } = setup();
    editor.runParallel(3);

    editor.discard();

    expect(editor.dirty()).toBe(false);
    expect(follows(editor, 3)).toEqual([]);
  });
});
