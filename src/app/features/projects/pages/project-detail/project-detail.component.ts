import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project.model';
import { ProjectSummary } from '../../models/project-summary.model';
import { EarnedValue } from '../../models/earned-value.model';
import { ProjectJob } from '../../models/project-job.model';
import { WbsElementSummary } from '../../models/wbs-element-summary.model';
import { PROJECT_STATUSES, PROJECT_STATUS_CHIP, ProjectStatus } from '../../models/project-status.model';
import { DELIVERABLES_CAPABILITY, PROJECT_DELETE_ROLES } from '../../models/project-roles.model';
import { WbsElementDialogComponent, WbsElementDialogData } from '../../components/wbs-element-dialog/wbs-element-dialog.component';
import { ProjectLinkJobDialogComponent, ProjectLinkJobDialogData } from '../../components/project-link-job-dialog/project-link-job-dialog.component';
import { ProjectDeliverablesComponent } from '../../components/project-deliverables/project-deliverables.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { TabListDirective, TabDirective } from '../../../../shared/directives/tab-list.directive';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

type ProjectTab = 'summary' | 'jobs' | 'deliverables';

interface WbsRow {
  id: number;
  code: string;
  name: string;
  type: string;
  budgetTotal: number;
  actualTotal: number;
  variance: number;
  depth: number;
  element: WbsElementSummary;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [DateOnlyPipe, 
    DecimalPipe, ReactiveFormsModule, RouterLink, TranslatePipe,
    PageHeaderComponent, SelectComponent, CurrencyDisplayComponent, EntityLinkComponent, LoadingBlockDirective,
    DataTableComponent, ColumnCellDirective,
    TabListDirective, TabDirective, ProjectDeliverablesComponent,
  ],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent {
  private readonly projectService = inject(ProjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly canDelete = this.auth.hasAnyRole(PROJECT_DELETE_ROLES);
  protected readonly deliverablesEnabled = computed(() => this.capabilities.isEnabled(DELIVERABLES_CAPABILITY));

  protected readonly tab = signal<ProjectTab>('summary');
  protected readonly loading = signal(false);
  protected readonly project = signal<Project | null>(null);
  protected readonly summary = signal<ProjectSummary | null>(null);
  protected readonly earnedValue = signal<EarnedValue | null>(null);
  protected readonly jobs = signal<ProjectJob[]>([]);

  protected readonly statusControl = new FormControl<ProjectStatus>('Planning', { nonNullable: true });
  protected readonly statusOptions: SelectOption[] = PROJECT_STATUSES.map(s => ({ value: s, label: this.translate.instant(`projects.status${s}`) }));

  protected readonly wbsRows = computed<WbsRow[]>(() => {
    const rows: WbsRow[] = [];
    const walk = (elements: WbsElementSummary[], depth: number) => {
      for (const e of elements) {
        rows.push({
          id: e.id, code: e.code, name: e.name, type: e.type,
          budgetTotal: e.budgetTotal, actualTotal: e.actualTotal, variance: e.variance, depth, element: e,
        });
        walk(e.children ?? [], depth + 1);
      }
    };
    walk(this.summary()?.wbsTree ?? [], 0);
    return rows;
  });

  protected readonly flatElements = computed(() => this.wbsRows().map(r => r.element));

  protected readonly wbsColumns: ColumnDef[] = [
    { field: 'code', header: this.translate.instant('projects.wbsCode'), width: '140px' },
    { field: 'name', header: this.translate.instant('common.name') },
    { field: 'type', header: this.translate.instant('common.type'), width: '140px' },
    { field: 'budgetTotal', header: this.translate.instant('projects.budget'), type: 'currency', align: 'right', width: '130px' },
    { field: 'actualTotal', header: this.translate.instant('projects.actual'), type: 'currency', align: 'right', width: '130px' },
    { field: 'variance', header: this.translate.instant('projects.variance'), type: 'currency', align: 'right', width: '130px' },
  ];

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      project: this.projectService.get(this.id),
      summary: this.projectService.summary(this.id),
      earnedValue: this.projectService.earnedValue(this.id),
      jobs: this.projectService.jobs(this.id),
    }).subscribe({
      next: r => {
        this.project.set(r.project);
        this.summary.set(r.summary);
        this.earnedValue.set(r.earnedValue);
        this.jobs.set(r.jobs);
        this.statusControl.setValue(r.project.status, { emitEvent: false });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusChip(status: ProjectStatus): string {
    return `chip ${PROJECT_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected changeStatus(): void {
    const status = this.statusControl.value;
    const project = this.project();
    if (!project || status === project.status) return;
    this.projectService.update(this.id, { status }).subscribe({
      next: updated => {
        this.project.set(updated);
        this.snackbar.success(this.translate.instant('projects.statusChanged'));
      },
      error: (err: unknown) => {
        this.statusControl.setValue(project.status, { emitEvent: false });
        this.snackbar.errorFrom(err, 'projects.saveFailed');
      },
    });
  }

  protected recalculate(): void {
    this.projectService.recalculate(this.id).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('projects.recalculated'));
        this.load();
      },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'projects.saveFailed'),
    });
  }

  protected addWbsElement(): void {
    this.dialog.open<WbsElementDialogComponent, WbsElementDialogData, boolean>(WbsElementDialogComponent, {
      width: '560px', data: { projectId: this.id, elements: this.flatElements() },
    }).afterClosed().subscribe(saved => {
      if (saved) this.load();
    });
  }

  protected linkJob(): void {
    this.dialog.open<ProjectLinkJobDialogComponent, ProjectLinkJobDialogData, boolean>(ProjectLinkJobDialogComponent, {
      width: '480px', data: { projectId: this.id, elements: this.flatElements() },
    }).afterClosed().subscribe(linked => {
      if (linked) this.projectService.jobs(this.id).subscribe({ next: jobs => this.jobs.set(jobs) });
    });
  }

  protected unlinkJob(job: ProjectJob): void {
    this.projectService.unlinkJob(this.id, job.wbsElementId, job.jobId).subscribe({
      next: () => {
        this.jobs.update(list => list.filter(j => !(j.jobId === job.jobId && j.wbsElementId === job.wbsElementId)));
        this.snackbar.success(this.translate.instant('projects.jobUnlinked'));
      },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'projects.saveFailed'),
    });
  }

  protected deleteProject(): void {
    const project = this.project();
    if (!project) return;
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('projects.deleteTitle'),
        message: this.translate.instant('projects.deleteMessage', { number: project.projectNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.projectService.delete(this.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('projects.deleted'));
          this.router.navigate(['/projects']);
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'projects.saveFailed'),
      });
    });
  }
}
