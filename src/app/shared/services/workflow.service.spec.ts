import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { EntityValidator } from '../models/entity-validator.model';
import { WorkflowDefinition } from '../models/workflow-definition.model';
import { WorkflowRun } from '../models/workflow-run.model';
import { WorkflowService } from './workflow.service';

/**
 * Workflow Pattern Phase 4 — WorkflowService unit tests.
 *
 * Focuses on the service's contract: signal updates on lifecycle events,
 * cache behavior on entity-typed fetches, completion derivation from the
 * loaded entity + validator catalog, 409 error envelope handling.
 */

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 1,
    entityType: 'Part',
    entityId: 42,
    definitionId: 'part-assembly-guided-v1',
    currentStepId: 'basics',
    mode: 'guided',
    startedAt: '2026-04-29T00:00:00Z',
    startedByUserId: 7,
    completedAt: null,
    abandonedAt: null,
    abandonedReason: null,
    lastActivityAt: '2026-04-29T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

function buildDefinitionResponse(overrides: Partial<{
  stepsJson: string;
  defaultMode: 'express' | 'guided';
}> = {}): unknown {
  return {
    id: 1,
    definitionId: 'part-assembly-guided-v1',
    entityType: 'Part',
    defaultMode: overrides.defaultMode ?? 'guided',
    stepsJson: overrides.stepsJson ?? JSON.stringify([
      { id: 'basics', labelKey: 'workflow.parts.steps.basics', componentName: 'PartBasicsStepComponent', required: true, completionGates: ['hasBasics'] },
      { id: 'bom', labelKey: 'workflow.parts.steps.bom', componentName: 'PartBomStepComponent', required: true, completionGates: ['hasBom'] },
      { id: 'alternates', labelKey: 'workflow.parts.steps.alternates', componentName: 'PartAlternatesStepComponent', required: false, completionGates: [] },
    ]),
    expressTemplateComponent: 'PartExpressFormComponent',
    isSeedData: true,
  };
}

function buildValidator(overrides: Partial<EntityValidator> = {}): EntityValidator {
  return {
    id: 1,
    entityType: 'Part',
    validatorId: 'hasBasics',
    predicate: JSON.stringify({
      type: 'all',
      of: [
        { type: 'fieldPresent', field: 'name' },
        { type: 'fieldPresent', field: 'type' },
      ],
    }),
    displayNameKey: 'workflow.parts.readiness.basics',
    missingMessageKey: 'workflow.parts.readiness.basicsMissing',
    isSeedData: true,
    ...overrides,
  };
}

describe('WorkflowService — Phase 4', () => {
  let service: WorkflowService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkflowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('startRun POSTs and updates currentRun signal', () => {
    const run = buildRun();
    service.startRun({ entityType: 'Part', definitionId: 'part-assembly-guided-v1' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows`);
    expect(req.request.method).toBe('POST');
    req.flush(run);
    expect(service.currentRun()).toEqual(run);
    expect(service.mode()).toBe('guided');
    expect(service.currentStepId()).toBe('basics');
  });

  it('getRun GETs and updates currentRun', () => {
    const run = buildRun({ id: 9 });
    service.getRun(9).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/9`);
    expect(req.request.method).toBe('GET');
    req.flush(run);
    expect(service.currentRun()).toEqual(run);
  });

  it('patchStep PATCHes step and updates run', () => {
    const updatedRun = buildRun({ currentStepId: 'bom' });
    service.patchStep(1, 'basics', { name: 'X', type: 'Assembly' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/1/step`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ stepId: 'basics', fields: { name: 'X', type: 'Assembly' } });
    req.flush(updatedRun);
    expect(service.currentRun()?.currentStepId).toBe('bom');
  });

  it('jumpToStep PATCHes jump and updates run', () => {
    const updated = buildRun({ currentStepId: 'basics' });
    service.jumpToStep(1, 'basics').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/1/jump`);
    expect(req.request.body).toEqual({ targetStepId: 'basics' });
    req.flush(updated);
    expect(service.currentRun()?.currentStepId).toBe('basics');
  });

  it('completeRun returns success on 200', () => {
    const completed = buildRun({ completedAt: '2026-04-30T00:00:00Z' });
    let result: unknown;
    service.completeRun(1).subscribe(r => (result = r));
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/1/complete`);
    req.flush(completed);
    expect(result).toEqual({ success: true, run: completed });
  });

  it('completeRun maps 409 missing-validator envelope to success:false', () => {
    let result: unknown;
    service.completeRun(1).subscribe(r => (result = r));
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/1/complete`);
    req.flush(
      { missing: [{ validatorId: 'hasBom', displayNameKey: 'k', missingMessageKey: 'm' }] },
      { status: 409, statusText: 'Conflict' },
    );
    expect(result).toEqual({
      success: false,
      missing: [{ validatorId: 'hasBom', displayNameKey: 'k', missingMessageKey: 'm' }],
    });
  });

  it('abandonRun POSTs reason payload', () => {
    const run = buildRun({ abandonedAt: '2026-04-30T00:00:00Z', abandonedReason: 'user' });
    service.abandonRun(1, 'user').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/1/abandon`);
    expect(req.request.body).toEqual({ reason: 'user' });
    req.flush(run);
    expect(service.currentRun()?.abandonedReason).toBe('user');
  });

  it('setMode toggles mode', () => {
    const run = buildRun({ mode: 'express' });
    service.setMode(1, 'express').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/1/mode`);
    expect(req.request.body).toEqual({ mode: 'express' });
    req.flush(run);
    expect(service.mode()).toBe('express');
  });

  it('listActive GETs the active list', () => {
    const runs = [buildRun(), buildRun({ id: 2 })];
    let result: WorkflowRun[] | undefined;
    service.listActive().subscribe(r => (result = r));
    const req = httpMock.expectOne(`${environment.apiUrl}/workflows/active`);
    req.flush(runs);
    expect(result?.length).toBe(2);
  });

  it('loadDefinitionsForEntity caches per-entityType', () => {
    service.loadDefinitionsForEntity('Part').subscribe();
    const req1 = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/workflow-definitions` && r.params.get('entityType') === 'Part',
    );
    req1.flush([buildDefinitionResponse()]);

    // Second call should NOT trigger another HTTP request (cached).
    let secondResult: WorkflowDefinition[] | undefined;
    service.loadDefinitionsForEntity('Part').subscribe(r => (secondResult = r));
    httpMock.expectNone(`${environment.apiUrl}/workflow-definitions`);
    expect(secondResult?.length).toBe(1);
    expect(secondResult?.[0]?.steps.length).toBe(3);

    // Different entity type → new request.
    service.loadDefinitionsForEntity('Customer').subscribe();
    httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/workflow-definitions` && r.params.get('entityType') === 'Customer',
    ).flush([]);
  });

  it('loadValidatorsForEntity caches per-entityType', () => {
    service.loadValidatorsForEntity('Part').subscribe();
    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/entity-validators` && r.params.get('entityType') === 'Part',
    );
    req.flush([buildValidator()]);

    service.loadValidatorsForEntity('Part').subscribe();
    httpMock.expectNone(`${environment.apiUrl}/entity-validators`);
  });

  it('clearCaches drops cached entries so next call hits the wire again', () => {
    service.loadDefinitionsForEntity('Part').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/workflow-definitions?entityType=Part`).flush([]);

    service.clearCaches();

    service.loadDefinitionsForEntity('Part').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/workflow-definitions?entityType=Part`).flush([]);
  });

  it('parseDefinition tolerates malformed stepsJson without throwing', () => {
    let captured: WorkflowDefinition[] | undefined;
    service.loadDefinitionsForEntity('Part').subscribe(r => (captured = r));
    const req = httpMock.expectOne(`${environment.apiUrl}/workflow-definitions?entityType=Part`);
    req.flush([buildDefinitionResponse({ stepsJson: 'not-json' })]);
    expect(captured?.[0]?.steps).toEqual([]);
  });

  it('stepCompletionMap derives completion from entity + validators', () => {
    const def: WorkflowDefinition = {
      id: 1,
      definitionId: 'part-assembly-guided-v1',
      entityType: 'Part',
      defaultMode: 'guided',
      steps: [
        { id: 'basics', labelKey: 'k', componentName: 'C', required: true, completionGates: ['hasBasics'] },
        { id: 'bom', labelKey: 'k', componentName: 'C', required: true, completionGates: ['hasBom'] },
      ],
      stepsJson: '[]',
      expressTemplateComponent: null,
      isSeedData: false,
    };
    const validators: EntityValidator[] = [
      buildValidator({
        validatorId: 'hasBasics',
        predicate: JSON.stringify({ type: 'fieldPresent', field: 'name' }),
      }),
      buildValidator({
        validatorId: 'hasBom',
        predicate: JSON.stringify({ type: 'relationExists', relation: 'bomEntries', minCount: 1 }),
      }),
    ];
    service.setContext({
      run: buildRun(),
      definition: def,
      entity: { name: 'Widget', bomEntries: [] },
      validators,
    });

    const map = service.stepCompletionMap();
    expect(map.get('basics')).toBe(true);
    expect(map.get('bom')).toBe(false);
    expect(service.canCompleteRun()).toBe(false);
  });

  it('canCompleteRun ignores optional steps', () => {
    const def: WorkflowDefinition = {
      id: 1,
      definitionId: 'part-assembly-guided-v1',
      entityType: 'Part',
      defaultMode: 'guided',
      steps: [
        { id: 'basics', labelKey: 'k', componentName: 'C', required: true, completionGates: ['hasBasics'] },
        { id: 'alternates', labelKey: 'k', componentName: 'C', required: false, completionGates: [] },
      ],
      stepsJson: '[]',
      expressTemplateComponent: null,
      isSeedData: false,
    };
    service.setContext({
      run: buildRun(),
      definition: def,
      entity: { name: 'Widget' },
      validators: [
        buildValidator({
          validatorId: 'hasBasics',
          predicate: JSON.stringify({ type: 'fieldPresent', field: 'name' }),
        }),
      ],
    });
    expect(service.canCompleteRun()).toBe(true);
  });

  it('clearContext zeroes the loaded run / definition / entity', () => {
    service.setContext({
      run: buildRun(),
      definition: null,
      entity: { name: 'Widget' },
      validators: [],
    });
    expect(service.currentRun()).not.toBeNull();
    service.clearContext();
    expect(service.currentRun()).toBeNull();
    expect(service.currentEntity()).toBeNull();
    expect(service.currentValidators()).toEqual([]);
  });

  it('promoteEntityStatus 409 maps to success:false with missing list', () => {
    let result: unknown;
    service.promoteEntityStatus('Part', 42, 'Active').subscribe(r => (result = r));
    const req = httpMock.expectOne(`${environment.apiUrl}/parts/42/promote-status`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetStatus: 'Active' });
    req.flush(
      { missing: [{ validatorId: 'hasCost', displayNameKey: 'k', missingMessageKey: 'm' }] },
      { status: 409, statusText: 'Conflict' },
    );
    expect(result).toEqual({
      success: false,
      missing: [{ validatorId: 'hasCost', displayNameKey: 'k', missingMessageKey: 'm' }],
    });
  });
});
