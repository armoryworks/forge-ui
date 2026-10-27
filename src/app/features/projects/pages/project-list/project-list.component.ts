import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project.model';
import { PROJECT_STATUSES, PROJECT_STATUS_CHIP, ProjectStatus } from '../../models/project-status.model';
import { ProjectCreateDialogComponent } from '../../components/project-create-dialog/project-create-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [DateOnlyPipe, ReactiveFormsModule, TranslatePipe, PageHeaderComponent, DataTableComponent, SelectComponent, CurrencyDisplayComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent {
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly projects = signal<Project[]>([]);
  protected readonly statusFilter = new FormControl<ProjectStatus | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    ...PROJECT_STATUSES.map(s => ({ value: s, label: this.translate.instant(`projects.status${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'projectNumber', header: this.translate.instant('projects.colNumber'), sortable: true, width: '120px' },
    { field: 'name', header: this.translate.instant('common.name'), sortable: true },
    { field: 'customerName', header: this.translate.instant('common.customer'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '110px' },
    { field: 'budgetTotal', header: this.translate.instant('projects.budget'), sortable: true, type: 'currency', align: 'right', width: '120px' },
    { field: 'actualTotal', header: this.translate.instant('projects.actual'), sortable: true, type: 'currency', align: 'right', width: '120px' },
    { field: 'percentComplete', header: this.translate.instant('projects.percentComplete'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'plannedEndDate', header: this.translate.instant('projects.plannedEnd'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.projectService.list({ status: this.statusFilter.value }).subscribe({
      next: page => {
        this.projects.set(page.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusChip(status: ProjectStatus): string {
    return `chip ${PROJECT_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected open(row: unknown): void {
    this.router.navigate(['/projects', (row as Project).id]);
  }

  protected openCreate(): void {
    this.dialog.open<ProjectCreateDialogComponent, undefined, Project | undefined>(ProjectCreateDialogComponent, { width: '560px' })
      .afterClosed().subscribe(created => {
        if (created) this.router.navigate(['/projects', created.id]);
      });
  }
}
