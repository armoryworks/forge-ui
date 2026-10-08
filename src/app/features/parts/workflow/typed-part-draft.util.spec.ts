import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowRun } from '../../../shared/models/workflow-run.model';
import { WorkflowService } from '../../../shared/services/workflow.service';
import { keepTypedPartDraft, readTypedPartDraft } from './typed-part-draft.util';

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 5,
    entityType: 'Part',
    entityId: null,
    definitionId: 'part-buy-component-v1',
    currentStepId: 'basics',
    mode: 'guided',
    startedAt: '2026-10-01T12:00:00Z',
    startedByUserId: 1,
    completedAt: null,
    abandonedAt: null,
    abandonedReason: null,
    lastActivityAt: '2026-10-01T12:00:00Z',
    version: 1,
    draftPayload: { procurementSource: 'Buy' },
    ...overrides,
  };
}

class FakeDestroyRef implements DestroyRef {
  private readonly callbacks: (() => void)[] = [];
  destroyed = false;
  onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => undefined;
  }
  destroy(): void {
    this.destroyed = true;
    this.callbacks.forEach(callback => callback());
  }
}

describe('readTypedPartDraft', () => {
  it('reads the typed object and trims it', () => {
    const run = buildRun({ draftPayload: { typed: { partNumber: ' BRK-1 ', name: 'Bracket', description: 7 } } });

    expect(readTypedPartDraft(run)).toEqual({ partNumber: 'BRK-1', name: 'Bracket', description: '' });
  });

  it('reads nothing from a missing run or payload', () => {
    expect(readTypedPartDraft(null)).toEqual({ partNumber: '', name: '', description: '' });
    expect(readTypedPartDraft(buildRun({ draftPayload: null }))).toEqual({ partNumber: '', name: '', description: '' });
  });
});

describe('keepTypedPartDraft', () => {
  let form: FormGroup;
  let destroyRef: FakeDestroyRef;
  let currentRun: ReturnType<typeof signal<WorkflowRun | null>>;
  let stepSavePending: ReturnType<typeof signal<boolean>>;
  let saveDraft: ReturnType<typeof vi.fn>;
  let entityId: number | null;

  function start(run: WorkflowRun | null): void {
    currentRun.set(run);
    TestBed.runInInjectionContext(() => keepTypedPartDraft({
      form,
      runId: () => 5,
      entityId: () => entityId,
      workflowService: { currentRun, stepSavePending, saveDraft } as unknown as WorkflowService,
      destroyRef,
    }));
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    form = new FormGroup({
      partNumber: new FormControl(''),
      name: new FormControl(''),
      description: new FormControl(''),
      traceabilityType: new FormControl('None'),
    });
    destroyRef = new FakeDestroyRef();
    currentRun = signal<WorkflowRun | null>(null);
    stepSavePending = signal(false);
    saveDraft = vi.fn(() => of(undefined));
    entityId = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves the typed text once typing pauses', () => {
    start(buildRun());

    form.patchValue({ partNumber: 'BRK-1', name: 'Brack' });
    form.patchValue({ name: 'Bracket ' });
    vi.advanceTimersByTime(799);
    expect(saveDraft).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith(5, { partNumber: 'BRK-1', name: 'Bracket', description: '' });
  });

  it('does not resend unchanged text, and does not send for fields outside the label', () => {
    start(buildRun());

    form.patchValue({ name: 'Bracket' });
    vi.advanceTimersByTime(800);
    form.patchValue({ name: 'Bracket  ', traceabilityType: 'Lot' });
    vi.advanceTimersByTime(800);

    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it('flushes unsent text when torn down', () => {
    start(buildRun());

    form.patchValue({ name: 'Bracket' });
    destroyRef.destroy();

    expect(saveDraft).toHaveBeenCalledWith(5, { partNumber: '', name: 'Bracket', description: '' });
  });

  it('sends nothing for an untouched form', () => {
    start(buildRun());

    destroyRef.destroy();

    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('sends nothing once the part exists, the run was closed, or a step save is in flight', () => {
    start(buildRun());

    stepSavePending.set(true);
    form.patchValue({ name: 'A' });
    vi.advanceTimersByTime(800);
    stepSavePending.set(false);

    currentRun.set(buildRun({ entityId: 12 }));
    form.patchValue({ name: 'B' });
    vi.advanceTimersByTime(800);

    currentRun.set(null);
    form.patchValue({ name: 'C' });
    destroyRef.destroy();

    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('sends nothing when the step already has an entity id', () => {
    entityId = 12;
    start(buildRun());

    form.patchValue({ name: 'Bracket' });
    vi.advanceTimersByTime(800);

    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('refills a pristine form from the saved text on resume and marks it dirty', () => {
    start(buildRun({ draftPayload: { typed: { partNumber: 'BRK-1', name: 'Bracket', description: 'Steel' } } }));

    expect(form.getRawValue()).toMatchObject({ partNumber: 'BRK-1', name: 'Bracket', description: 'Steel' });
    expect(form.dirty).toBe(true);
    vi.advanceTimersByTime(800);
    destroyRef.destroy();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('retries after a failed save', () => {
    saveDraft.mockReturnValueOnce({ subscribe: (observer: { error: () => void }) => observer.error() });
    start(buildRun());

    form.patchValue({ name: 'Bracket' });
    vi.advanceTimersByTime(800);
    destroyRef.destroy();

    expect(saveDraft).toHaveBeenCalledTimes(2);
  });
});
