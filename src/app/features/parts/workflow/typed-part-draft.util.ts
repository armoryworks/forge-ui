import { DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { debounceTime } from 'rxjs';

import { WorkflowRun } from '../../../shared/models/workflow-run.model';
import { WorkflowService } from '../../../shared/services/workflow.service';
import { TypedPartDraft } from '../models/typed-part-draft.model';

const TYPED_KEY = 'typed';
const EMPTY_KEY = JSON.stringify({ partNumber: '', name: '', description: '' });

/**
 * Reads the part number, name and description saved on an entity-less New
 * Part run by {@link keepTypedPartDraft}. Missing or non-string values read
 * as empty strings.
 */
export function readTypedPartDraft(run: WorkflowRun | null | undefined): TypedPartDraft {
  const typed = run?.draftPayload?.[TYPED_KEY];
  const source = typed && typeof typed === 'object' ? (typed as Record<string, unknown>) : {};
  return {
    partNumber: text(source['partNumber']),
    name: text(source['name']),
    description: text(source['description']),
  };
}

/**
 * Keeps a New Part form's part number, name and description on its run while
 * the part does not exist yet, so the parts list shows the draft under what
 * was typed. Saves after a pause in typing and once more when the form is
 * torn down (leaving the page without Close). Nothing is sent once the part
 * exists, while a step save is in flight, after the run was closed, or when
 * the text has not changed since the last save.
 *
 * On resume it also refills a still-pristine form from the saved text and
 * marks it dirty, so the first step save carries those values.
 *
 * Must be called in an injection context (a constructor).
 */
export function keepTypedPartDraft(options: {
  form: FormGroup;
  runId: () => number | null;
  entityId: () => number | null;
  workflowService: WorkflowService;
  destroyRef: DestroyRef;
  debounceMs?: number;
}): void {
  const { form, runId, entityId, workflowService, destroyRef } = options;
  let lastSent: string | null = EMPTY_KEY;
  let restored = false;

  const activeRun = (): WorkflowRun | null => {
    const id = runId();
    const run = workflowService.currentRun();
    if (id == null || entityId() != null || !run || run.id !== id) return null;
    if (run.entityId != null || run.completedAt != null || run.abandonedAt != null) return null;
    return run;
  };

  const send = (): void => {
    const run = activeRun();
    if (!run || workflowService.stepSavePending()) return;
    const typed = typedFromForm(form);
    const key = JSON.stringify(typed);
    if (key === lastSent) return;
    lastSent = key;
    workflowService.saveDraft(run.id, { ...typed }).subscribe({
      error: () => { lastSent = null; },
    });
  };

  effect(() => {
    if (restored) return;
    const run = activeRun();
    if (!run) return;
    restored = true;
    const typed = readTypedPartDraft(run);
    const key = JSON.stringify(typed);
    if (key === EMPTY_KEY || form.dirty) return;
    form.patchValue(typed, { emitEvent: false });
    form.markAsDirty();
    form.updateValueAndValidity();
    lastSent = key;
  });

  form.valueChanges
    .pipe(debounceTime(options.debounceMs ?? 800), takeUntilDestroyed(destroyRef))
    .subscribe(() => send());
  destroyRef.onDestroy(() => send());
}

function typedFromForm(form: FormGroup): TypedPartDraft {
  const value = form.getRawValue() as Record<string, unknown>;
  return {
    partNumber: text(value['partNumber']),
    name: text(value['name']),
    description: text(value['description']),
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
