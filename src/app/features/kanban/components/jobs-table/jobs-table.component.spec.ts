import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';

import { Observable, of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ServerPageRequest, ServerPageState } from '../../../../shared/models/server-page-state.model';
import { Stage } from '../../../../shared/models/stage.model';
import { TrackType } from '../../../../shared/models/track-type.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import { JobsTableService } from '../../services/jobs-table.service';
import { KanbanService } from '../../services/kanban.service';
import { KanbanJob } from '../../models/kanban-job.model';
import { JobTableRow } from '../../models/job-table-row.model';
import { JobsTableQuery } from '../../models/jobs-table-query.model';
import { JobsTablePageRequest } from '../../models/jobs-table-page-request.model';
import { JobsTableComponent, JOBS_TABLE_LOCAL_LIMIT } from './jobs-table.component';

interface Internals {
  columns: () => ColumnDef[];
  rows: () => JobTableRow[];
  serverState: () => ServerPageState | null;
  canMove: () => boolean;
  onServerPageChange(request: ServerPageRequest): void;
  moveStage(row: JobTableRow, stage: Stage): void;
  onRowClick(row: unknown): void;
}

function job(id: number, overrides: Partial<KanbanJob> = {}): KanbanJob {
  return {
    id, jobNumber: `J-${id}`, title: `Job ${id}`, stageName: 'Open', stageColor: '#111111',
    assigneeId: null, assigneeInitials: null, assigneeColor: null, priorityName: 'Normal', dueDate: null,
    isOverdue: false, customerName: null, customerId: null, salesOrderId: null, salesOrderNumber: null,
    billingStatus: null, externalRef: null, accountingDocumentType: null, disposition: null, childJobCount: 0,
    activeHolds: [], coverPhotoUrl: null, parentJobId: null, parentJobNumber: null, boardPosition: 0,
    partNumber: null, quantity: null, currentStageId: 1, trackTypeId: 5, ...overrides,
  };
}

const build: Stage = {
  id: 2, name: 'Build', code: 'b', sortOrder: 2, color: '#222222', wipLimit: null,
  accountingDocumentType: null, isIrreversible: false, isMandatory: false,
};
const trackTypes: TrackType[] = [{
  id: 5, name: 'Production', code: 'p', description: null, isDefault: true, sortOrder: 1,
  stages: [{ ...build, id: 1, name: 'Open', sortOrder: 1, color: '#111111' }, build],
}];

const query: JobsTableQuery = {
  trackTypeId: 5,
  filters: { activeOnly: true, search: '', customerId: null, overdueOnly: false, onHoldOnly: false, teamId: null },
  includeArchived: false,
  assigneeIds: [],
  myWorkUserId: null,
};

describe('JobsTableComponent', () => {
  let fixture: ComponentFixture<JobsTableComponent>;
  let component: Internals;
  let roles: string[];
  let getPage: ReturnType<typeof vi.fn>;
  let getJobDetail: ReturnType<typeof vi.fn>;
  let moveJobStage: ReturnType<typeof vi.fn>;
  let total: number;

  function create(): void {
    fixture = TestBed.createComponent(JobsTableComponent);
    fixture.componentRef.setInput('query', query);
    fixture.componentRef.setInput('trackTypes', trackTypes);
    component = fixture.componentInstance as unknown as Internals;
    fixture.detectChanges();
  }

  beforeEach(() => {
    roles = ['Manager'];
    total = 3;
    getPage = vi.fn((_q: JobsTableQuery, request: JobsTablePageRequest): Observable<unknown> => of({
      items: Array.from({ length: Math.min(total, request.pageSize) }, (_, i) => job(i + 1)),
      totalCount: total,
      page: request.page,
      pageSize: request.pageSize,
    }));
    getJobDetail = vi.fn(() => of({}));
    moveJobStage = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      imports: [JobsTableComponent],
      providers: [
        provideTranslateService(),
        { provide: JobsTableService, useValue: { getPage } },
        { provide: KanbanService, useValue: { getJobDetail, moveJobStage } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn(), reset: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(JobsTableComponent, { set: { template: '' } });
  });

  it('loads a result that fits in one page whole and leaves sorting, filtering and paging to the browser', () => {
    create();

    expect(getPage).toHaveBeenCalledOnce();
    expect(getPage.mock.calls[0][1]).toEqual({ page: 1, pageSize: JOBS_TABLE_LOCAL_LIMIT, sort: null, order: 'desc', filters: [] });
    expect(component.serverState()).toBeNull();
    expect(component.rows().map(r => r.id)).toEqual([1, 2, 3]);
  });

  it('pages on the server once the result outgrows one page, sending sort and column filters there', () => {
    total = JOBS_TABLE_LOCAL_LIMIT + 1;
    create();

    expect(getPage).toHaveBeenCalledTimes(2);
    expect(getPage.mock.calls[1][1]).toEqual({ page: 1, pageSize: 25, sort: null, order: 'asc', filters: [] });
    expect(component.serverState()).toMatchObject({ totalCount: JOBS_TABLE_LOCAL_LIMIT + 1, filterable: true });

    component.onServerPageChange({
      pageIndex: 2, pageSize: 50, sort: 'dueDate', order: 'desc',
      filters: { title: 'weld', currentStageId: [2], operationsProgress: { min: 0.5 } },
    });

    expect(getPage.mock.calls[2][1]).toEqual({
      page: 3, pageSize: 50, sort: 'dueDate', order: 'desc', filters: ['title:contains:weld', 'currentStageId:in:2'],
    });
    expect(component.serverState()).toMatchObject({ pageIndex: 2, pageSize: 50, sort: 'dueDate', order: 'desc' });
  });

  it('shows a small default column set and keeps the rest in the column manager', () => {
    create();
    const visible = component.columns().filter(c => c.visible !== false).map(c => c.field);

    expect(visible).toEqual(['jobNumber', 'title', 'currentStageId', 'assigneeId', 'priorityName', 'dueDate', 'customerName', 'completedDate', 'createdAt']);
    expect(component.columns().map(c => c.field)).toEqual(expect.arrayContaining([
      'trackTypeId', 'partNumber', 'quantity', 'targetQuantity', 'salesOrderNumber', 'isOverdue', 'onHold',
      'operationsProgress', 'runningTimerCount', 'estimatedRemainingMinutes', 'parentJobNumber', 'childJobCount',
      'billingStatus', 'externalRef', 'disposition', 'startDate', 'updatedAt', 'estimatedTotalCost', 'quotedPrice',
    ]));
  });

  it('shows the order type column by default only when listing every order type', () => {
    create();
    expect(component.columns().find(c => c.field === 'trackTypeId')!.visible).toBe(false);

    fixture.componentRef.setInput('query', { ...query, trackTypeId: null });
    expect(component.columns().find(c => c.field === 'trackTypeId')!.visible).toBe(true);
  });

  it.each([
    ['Procurement', ['customerName', 'salesOrderNumber', 'billingStatus', 'externalRef', 'estimatedTotalCost', 'quotedPrice']],
    ['ProductionWorker', ['salesOrderNumber', 'billingStatus', 'externalRef', 'estimatedTotalCost', 'quotedPrice']],
    ['Engineer', ['salesOrderNumber', 'billingStatus', 'externalRef']],
    ['PM', ['billingStatus', 'externalRef']],
  ])('leaves out the columns a %s may not read', (role, hidden) => {
    roles = [role];
    create();
    const fields = component.columns().map(c => c.field);

    for (const field of hidden) expect(fields, field).not.toContain(field);
  });

  it('keeps client-computed columns away from the server', () => {
    create();
    const clientOnly = component.columns().filter(c => c.serverSortable === false || c.serverFilterable === false).map(c => c.field);

    expect(clientOnly).toEqual(['operationsProgress', 'runningTimerCount', 'estimatedRemainingMinutes']);
  });

  it('moves a job through the same calls as a board drag and shows the new stage at once', () => {
    create();
    const row = component.rows()[0];

    component.moveStage(row, build);

    expect(getJobDetail).toHaveBeenCalledWith(row.id);
    expect(moveJobStage).toHaveBeenCalledWith(row.id, build.id);
    expect(component.rows()[0]).toMatchObject({ currentStageId: 2, stageName: 'Build', stageColor: '#222222' });
  });

  it('reloads after a refused move so the row shows where the job really is', () => {
    create();
    moveJobStage.mockReturnValue(throwError(() => ({ status: 409 })));
    getPage.mockClear();

    component.moveStage(component.rows()[0], build);

    expect(getPage).toHaveBeenCalledOnce();
    expect(component.rows()[0].stageName).toBe('Open');
  });

  it('is read-only for roles that cannot move jobs', () => {
    roles = ['Procurement'];
    create();
    expect(component.canMove()).toBe(false);
  });

  it('opens the job detail on a row click', () => {
    create();
    const opened = vi.fn();
    fixture.componentInstance.jobOpened.subscribe(opened);

    component.onRowClick(component.rows()[1]);

    expect(opened).toHaveBeenCalledWith(2);
  });

  it('reloads when the board filters change or the board asks', () => {
    create();
    getPage.mockClear();

    fixture.componentRef.setInput('query', { ...query, includeArchived: true });
    fixture.detectChanges();
    fixture.componentRef.setInput('reloadToken', 1);
    fixture.detectChanges();

    expect(getPage).toHaveBeenCalledTimes(2);
    expect(getPage.mock.calls[0][0].includeArchived).toBe(true);
  });
});
