import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { Subscription, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { ServerPageRequest, ServerPageState } from '../../../../shared/models/server-page-state.model';
import { Stage } from '../../../../shared/models/stage.model';
import { TrackType } from '../../../../shared/models/track-type.model';
import { PRIORITIES } from '../../../../shared/models/priority.const';
import { BILLING_STAGE_ROLES } from '../../../../shared/models/billing-stage-roles.const';
import { AuthService } from '../../../../shared/services/auth.service';
import { DisplayLabelService } from '../../../../shared/services/display-label.service';
import { JobStageSelectComponent } from '../job-stage-select/job-stage-select.component';
import { JobsTableService } from '../../services/jobs-table.service';
import { KanbanService } from '../../services/kanban.service';
import { KanbanJob } from '../../models/kanban-job.model';
import { JobTableRow } from '../../models/job-table-row.model';
import { JobsTableQuery } from '../../models/jobs-table-query.model';
import { JobDisposition } from '../../models/job-disposition.type';
import { UserRef } from '../../models/user-ref.model';
import { toServerFilters } from '../../utils/job-table-filters';
import { describeColumnFilter } from '../../utils/job-table-filter-chips';
import {
  JOB_BILLING_FIELD_ROLES,
  JOB_COST_FIELD_ROLES,
  JOB_CUSTOMER_FIELD_ROLES,
  JOB_MOVE_ROLES,
  JOB_SALES_ORDER_FIELD_ROLES,
} from '../../job-roles';

/** Result sets up to this size load whole and sort, filter and page in the browser; larger ones page on the server. */
export const JOBS_TABLE_LOCAL_LIMIT = 200;

const DISPOSITIONS: readonly JobDisposition[] = [
  'ShipToCustomer', 'AddToInventory', 'CapitalizeAsAsset', 'Scrap', 'HoldForReview', 'EnteredInError', 'Other',
];

const BILLING_STATUSES = ['Invoiced', 'Uninvoiced'] as const;

interface FilterChip {
  field: string;
  header: string;
  summary: string;
}

/**
 * The jobs table beside the kanban board: one row per job from `GET /jobs`, with the board's
 * filters as its source. When the whole result fits in {@link JOBS_TABLE_LOCAL_LIMIT} rows it is
 * loaded once and the shared data table sorts, filters and pages it locally; otherwise every sort,
 * column filter and page goes to the server. Columns whose data the role may not read are left
 * out, matching what the API withholds.
 */
@Component({
  selector: 'app-jobs-table',
  standalone: true,
  imports: [DataTableComponent, ColumnCellDirective, AvatarComponent, JobStageSelectComponent, TranslatePipe],
  templateUrl: './jobs-table.component.html',
  styleUrl: './jobs-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobsTableComponent {
  private readonly jobsTable = inject(JobsTableService);
  private readonly kanban = inject(KanbanService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly labels = inject(DisplayLabelService);

  readonly query = input.required<JobsTableQuery>();
  readonly trackTypes = input<TrackType[]>([]);
  readonly users = input<UserRef[]>([]);
  readonly reloadToken = input(0);

  readonly jobOpened = output<number>();
  readonly selectionChanged = output<KanbanJob[]>();

  private readonly table = viewChild(DataTableComponent);

  protected readonly rows = signal<JobTableRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly serverState = signal<ServerPageState | null>(null);
  private load: Subscription | null = null;

  protected readonly canMove = computed(() => this.auth.hasAnyRole(JOB_MOVE_ROLES));
  protected readonly mayBill = computed(() => this.auth.hasAnyRole([...BILLING_STAGE_ROLES]));
  private readonly seesCustomer = computed(() => this.auth.hasAnyRole(JOB_CUSTOMER_FIELD_ROLES));
  private readonly seesSalesOrder = computed(() => this.auth.hasAnyRole(JOB_SALES_ORDER_FIELD_ROLES));
  private readonly seesBilling = computed(() => this.auth.hasAnyRole(JOB_BILLING_FIELD_ROLES));
  private readonly seesCost = computed(() => this.auth.hasAnyRole(JOB_COST_FIELD_ROLES));

  protected readonly stagesByTrack = computed(() =>
    new Map(this.trackTypes().map(tt => [tt.id, tt.stages] as const)));

  private readonly stageById = computed(() =>
    new Map(this.trackTypes().flatMap(tt => tt.stages.map(s => [s.id, s] as const))));

  protected readonly columns = computed<ColumnDef[]>(() => {
    const allTracks = this.query().trackTypeId === null;
    const yesNo: SelectOption[] = [
      { value: true, label: this.labels.booleanLabel(true) },
      { value: false, label: this.labels.booleanLabel(false) },
    ];
    const cols: (ColumnDef | null)[] = [
      { field: 'jobNumber', header: 'jobsTable.columns.jobNumber', sortable: true, width: '110px' },
      { field: 'title', header: 'jobsTable.columns.title', sortable: true },
      {
        field: 'currentStageId', header: 'jobsTable.columns.stage', sortable: true, type: 'enum', width: '170px',
        filterOptions: this.stageOptions(),
        sortValue: row => this.stageById().get((row as JobTableRow).currentStageId ?? -1)?.sortOrder ?? null,
        exportValue: row => (row as JobTableRow).stageName,
      },
      {
        field: 'assigneeId', header: 'jobsTable.columns.assignee', sortable: true, type: 'enum', width: '150px',
        filterOptions: this.users().map(u => ({ value: u.id, label: u.name })),
        sortValue: row => (row as JobTableRow).assigneeName ?? null,
        exportValue: row => (row as JobTableRow).assigneeName ?? '',
      },
      {
        field: 'priorityName', header: 'jobsTable.columns.priority', sortable: true, type: 'enum', width: '90px',
        filterOptions: PRIORITIES.map(p => ({ value: p, label: p })),
        sortValue: row => PRIORITIES.indexOf((row as JobTableRow).priorityName as (typeof PRIORITIES)[number]),
      },
      { field: 'dueDate', header: 'jobsTable.columns.dueDate', sortable: true, type: 'date', width: '100px' },
      this.seesCustomer() ? { field: 'customerName', header: 'jobsTable.columns.customer', sortable: true } : null,
      { field: 'completedDate', header: 'jobsTable.columns.completedDate', sortable: true, type: 'date', width: '110px' },
      { field: 'createdAt', header: 'jobsTable.columns.createdAt', sortable: true, type: 'date', width: '150px' },
      {
        field: 'trackTypeId', header: 'jobsTable.columns.trackType', sortable: true, type: 'enum', visible: allTracks,
        filterOptions: this.trackTypes().map(tt => ({ value: tt.id, label: tt.name })),
        sortValue: row => (row as JobTableRow).trackTypeName ?? null,
        exportValue: row => (row as JobTableRow).trackTypeName ?? '',
      },
      { field: 'partNumber', header: 'jobsTable.columns.part', sortable: true, visible: false },
      { field: 'quantity', header: 'jobsTable.columns.quantity', sortable: true, type: 'number', align: 'right', visible: false },
      { field: 'targetQuantity', header: 'jobsTable.columns.targetQuantity', sortable: true, type: 'number', align: 'right', visible: false },
      this.seesSalesOrder() ? { field: 'salesOrderNumber', header: 'jobsTable.columns.salesOrder', sortable: true, visible: false } : null,
      { field: 'isOverdue', header: 'jobsTable.columns.overdue', sortable: true, type: 'enum', filterOptions: yesNo, visible: false },
      {
        field: 'onHold', header: 'jobsTable.columns.holds', sortable: true, type: 'enum', filterOptions: yesNo, visible: false,
        exportValue: row => (row as JobTableRow).activeHolds.join(', '),
      },
      {
        field: 'operationsProgress', header: 'jobsTable.columns.operations', sortable: true, type: 'number', visible: false,
        serverSortable: false, serverFilterable: false,
        exportValue: row => this.operationsText(row as JobTableRow),
      },
      {
        field: 'runningTimerCount', header: 'jobsTable.columns.runningTimers', sortable: true, type: 'number', align: 'right',
        visible: false, serverSortable: false, serverFilterable: false,
      },
      {
        field: 'estimatedRemainingMinutes', header: 'jobsTable.columns.estimatedRemaining', sortable: true, type: 'number',
        align: 'right', visible: false, serverSortable: false, serverFilterable: false,
      },
      { field: 'parentJobNumber', header: 'jobsTable.columns.parentJob', sortable: true, visible: false },
      { field: 'childJobCount', header: 'jobsTable.columns.childJobs', sortable: true, type: 'number', align: 'right', visible: false },
      this.seesBilling() ? {
        field: 'billingStatus', header: 'jobsTable.columns.billingStatus', sortable: true, type: 'enum', visible: false,
        filterOptions: BILLING_STATUSES.map(s => ({ value: s, label: this.translate.instant(`jobsTable.billing${s}`) })),
      } : null,
      this.seesBilling() ? { field: 'externalRef', header: 'jobsTable.columns.externalRef', sortable: true, visible: false } : null,
      {
        field: 'disposition', header: 'jobsTable.columns.disposition', sortable: true, type: 'enum', visible: false,
        filterOptions: DISPOSITIONS.map(d => ({ value: d, label: this.translate.instant(`kanban.disposition${d}`) })),
        sortValue: row => {
          const index = DISPOSITIONS.indexOf((row as JobTableRow).disposition as JobDisposition);
          return index < 0 ? null : index;
        },
      },
      { field: 'startDate', header: 'jobsTable.columns.startDate', sortable: true, type: 'date', visible: false },
      { field: 'updatedAt', header: 'jobsTable.columns.updatedAt', sortable: true, type: 'date', width: '150px', visible: false },
      this.seesCost() ? {
        field: 'estimatedTotalCost', header: 'jobsTable.columns.estimatedCost', sortable: true, type: 'currency', align: 'right', visible: false,
      } : null,
      this.seesCost() ? {
        field: 'quotedPrice', header: 'jobsTable.columns.quotedPrice', sortable: true, type: 'currency', align: 'right', visible: false,
      } : null,
    ];
    return cols.filter((c): c is ColumnDef => c !== null);
  });

  protected readonly filterChips = computed<FilterChip[]>(() => {
    const active = this.table()?.activeFilters() ?? {};
    const byField = new Map(this.columns().map(c => [c.field, c]));
    return Object.entries(active).flatMap(([field, value]) => {
      const col = byField.get(field);
      if (!col) return [];
      const summary = describeColumnFilter(col, value, v => this.labels.booleanLabel(v));
      return summary ? [{ field, header: col.header, summary }] : [];
    });
  });

  constructor() {
    effect(() => {
      this.query();
      this.reloadToken();
      untracked(() => this.reload());
    });
  }

  clearSelection(): void {
    this.table()?.clearSelection();
  }

  protected onRowClick(row: unknown): void {
    this.jobOpened.emit((row as JobTableRow).id);
  }

  protected onSelectionChange(rows: unknown[]): void {
    this.selectionChanged.emit(rows as KanbanJob[]);
  }

  protected onServerPageChange(request: ServerPageRequest): void {
    this.fetchServerPage(request);
  }

  protected removeFilter(field: string): void {
    this.table()?.onFilterCleared(field);
  }

  protected clearFilters(): void {
    this.table()?.contextClearAllFilters();
  }

  protected moveStage(row: JobTableRow, stage: Stage): void {
    this.rows.update(rows => rows.map(r => r.id === row.id
      ? { ...r, currentStageId: stage.id, stageName: stage.name, stageColor: stage.color }
      : r));
    this.kanban.getJobDetail(row.id).pipe(
      switchMap(() => this.kanban.moveJobStage(row.id, stage.id)),
    ).subscribe({ error: () => this.reload() });
  }

  protected operationsText(row: JobTableRow): string {
    return row.operationsTotal ? `${row.operationsComplete ?? 0} / ${row.operationsTotal}` : '';
  }

  private reload(): void {
    this.load?.unsubscribe();
    this.loading.set(true);
    const query = this.query();
    this.load = this.jobsTable.getPage(query, { page: 1, pageSize: JOBS_TABLE_LOCAL_LIMIT, sort: null, order: 'desc', filters: [] })
      .subscribe({
        next: page => {
          if (page.totalCount <= page.items.length) {
            this.serverState.set(null);
            this.rows.set(page.items.map(toRow));
            this.loading.set(false);
            return;
          }
          this.fetchServerPage(this.table()?.serverRequest()
            ?? { pageIndex: 0, pageSize: 25, sort: null, order: 'asc', filters: {} });
        },
        error: (err: HttpErrorResponse) => this.failed(err),
      });
  }

  private fetchServerPage(request: ServerPageRequest): void {
    this.load?.unsubscribe();
    this.loading.set(true);
    this.load = this.jobsTable.getPage(this.query(), {
      page: request.pageIndex + 1,
      pageSize: request.pageSize,
      sort: request.sort,
      order: request.order,
      filters: toServerFilters(request.filters ?? {}, this.columns()),
    }).subscribe({
      next: page => {
        this.rows.set(page.items.map(toRow));
        this.serverState.set({
          pageIndex: request.pageIndex,
          pageSize: request.pageSize,
          totalCount: page.totalCount,
          sort: request.sort,
          order: request.order,
          filterable: true,
        });
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => this.failed(err),
    });
  }

  private failed(err: HttpErrorResponse): void {
    if (err?.status === 0) return;
    this.loading.set(false);
  }

  private stageOptions(): SelectOption[] {
    const track = this.query().trackTypeId;
    const types = track === null ? this.trackTypes() : this.trackTypes().filter(tt => tt.id === track);
    return types.flatMap(tt => [...tt.stages]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(s => ({ value: s.id, label: track === null ? `${tt.name} · ${s.name}` : s.name })));
  }
}

function toRow(job: KanbanJob): JobTableRow {
  return {
    ...job,
    onHold: job.activeHolds.length > 0,
    operationsProgress: job.operationsTotal ? (job.operationsComplete ?? 0) / job.operationsTotal : null,
  };
}
