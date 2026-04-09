import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';

import { environment } from '../../../../../environments/environment';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { openDetailDialog } from '../../../../shared/utils/detail-dialog.utils';
import { TrainingService } from '../../../training/services/training.service';

export interface TrainingModuleRow {
  id: number;
  title: string;
  contentType: string;
  estimatedMinutes: number;
  isPublished: boolean;
  appRoutes: string[];
  tags: string[];
}

export interface TrainingPathRow {
  id: number;
  title: string;
  icon: string;
  isAutoAssigned: boolean;
  isActive: boolean;
  moduleCount: number;
}

export interface UserProgressRow {
  userId: number;
  displayName: string;
  role: string;
  totalEnrolled: number;
  totalCompleted: number;
  overallCompletionPct: number;
  lastActivityAt: string | null;
}

export type PanelSubTab = 'content' | 'paths' | 'progress';

@Component({
  selector: 'app-training-panel',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    DataTableComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
    InputComponent,
  ],
  templateUrl: './training-panel.component.html',
  styleUrl: './training-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPanelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly trainingService = inject(TrainingService);

  private readonly base = `${environment.apiUrl}/training`;
  protected readonly activeSubTab = signal<PanelSubTab>('content');
  protected readonly isLoading = signal(false);
  protected readonly generatingModuleId = signal<number | null>(null);

  protected readonly modules = signal<TrainingModuleRow[]>([]);
  protected readonly paths = signal<TrainingPathRow[]>([]);
  protected readonly userProgress = signal<UserProgressRow[]>([]);

  protected readonly moduleSearchControl = new FormControl('');

  protected readonly moduleColumns: ColumnDef[] = [
    { field: 'title', header: 'Title', sortable: true },
    { field: 'contentType', header: 'Type', sortable: true, width: '120px' },
    { field: 'estimatedMinutes', header: 'Time (min)', sortable: true, width: '100px', align: 'right' },
    { field: 'isPublished', header: 'Published', sortable: true, width: '100px', align: 'center' },
    { field: 'actions', header: '', width: '120px', align: 'right' },
  ];

  protected readonly pathColumns: ColumnDef[] = [
    { field: 'title', header: 'Title', sortable: true },
    { field: 'moduleCount', header: 'Modules', sortable: true, width: '90px', align: 'right' },
    { field: 'isAutoAssigned', header: 'Auto-Assign', sortable: true, width: '110px', align: 'center' },
    { field: 'isActive', header: 'Active', sortable: true, width: '80px', align: 'center' },
    { field: 'actions', header: '', width: '60px', align: 'right' },
  ];

  protected readonly progressColumns: ColumnDef[] = [
    { field: 'displayName', header: 'User', sortable: true },
    { field: 'role', header: 'Role', sortable: true, width: '120px' },
    { field: 'totalEnrolled', header: 'Enrolled', sortable: true, width: '90px', align: 'right' },
    { field: 'totalCompleted', header: 'Completed', sortable: true, width: '100px', align: 'right' },
    { field: 'overallCompletionPct', header: 'Progress', sortable: true, width: '100px', align: 'right' },
    { field: 'lastActivityAt', header: 'Last Activity', sortable: true, type: 'date', width: '130px' },
    { field: 'detail', header: '', width: '60px', align: 'right' },
  ];

  ngOnInit(): void {
    this.loadModules();
    this.loadPaths();
    this.loadProgress();
  }

  protected switchSubTab(tab: PanelSubTab): void {
    this.activeSubTab.set(tab);
  }

  private loadModules(): void {
    this.isLoading.set(true);
    this.http.get<{ data: TrainingModuleRow[] }>(`${this.base}/modules?pageSize=100&includeUnpublished=true`)
      .subscribe({
        next: r => { this.modules.set(r.data); this.isLoading.set(false); },
        error: () => this.isLoading.set(false),
      });
  }

  private loadPaths(): void {
    this.http.get<TrainingPathRow[]>(`${this.base}/paths`)
      .subscribe({ next: paths => this.paths.set(paths) });
  }

  private loadProgress(): void {
    this.http.get<UserProgressRow[]>(`${this.base}/admin/progress-summary`)
      .subscribe({ next: data => this.userProgress.set(data) });
  }

  protected openCreateModuleDialog(): void {
    import('./training-module-dialog.component').then(({ TrainingModuleDialogComponent }) => {
      this.dialog.open(TrainingModuleDialogComponent, {
        width: '800px',
        data: null,
      }).afterClosed().subscribe(created => {
        if (created) {
          this.loadModules();
          this.snackbar.success('Training module created');
        }
      });
    });
  }

  protected openEditModuleDialog(module: TrainingModuleRow): void {
    import('./training-module-dialog.component').then(({ TrainingModuleDialogComponent }) => {
      this.dialog.open(TrainingModuleDialogComponent, {
        width: '800px',
        data: module,
      }).afterClosed().subscribe(updated => {
        if (updated) {
          this.loadModules();
          this.snackbar.success('Training module updated');
        }
      });
    });
  }

  protected deleteModule(module: TrainingModuleRow): void {
    this.http.delete(`${this.base}/modules/${module.id}`).subscribe({
      next: () => {
        this.loadModules();
        this.snackbar.success('Module deleted');
      },
    });
  }

  protected openCreatePathDialog(): void {
    import('./training-path-dialog.component').then(({ TrainingPathDialogComponent }) => {
      this.dialog.open(TrainingPathDialogComponent, {
        width: '600px',
        data: null,
      }).afterClosed().subscribe(created => {
        if (created) {
          this.loadPaths();
          this.snackbar.success('Training path created');
        }
      });
    });
  }

  protected openDetailDialog(user: UserProgressRow): void {
    import('../training-detail-dialog/training-detail-dialog.component').then(({ TrainingDetailDialogComponent }) => {
      openDetailDialog(this.dialog, TrainingDetailDialogComponent, {
        userId: user.userId,
      });
    });
  }

  protected generateWalkthrough(module: TrainingModuleRow): void {
    if (this.generatingModuleId() !== null) return;
    this.generatingModuleId.set(module.id);
    this.trainingService.generateWalkthrough(module.id).subscribe({
      next: result => {
        this.generatingModuleId.set(null);
        import('./walkthrough-preview-dialog.component').then(({ WalkthroughPreviewDialogComponent }) => {
          this.dialog.open(WalkthroughPreviewDialogComponent, {
            width: '720px',
            data: {
              moduleId: module.id,
              moduleTitle: module.title,
              steps: result.steps,
            },
          }).afterClosed().subscribe(saved => {
            if (saved) this.loadModules();
          });
        });
      },
      error: () => {
        this.generatingModuleId.set(null);
        this.snackbar.error('Failed to generate walkthrough steps');
      },
    });
  }

  protected contentTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      Article: 'article',
      Walkthrough: 'route',
      QuickRef: 'quick_reference_all',
      Quiz: 'quiz',
    };
    return icons[type] ?? 'school';
  }

  protected contentTypeClass(type: string): string {
    const classes: Record<string, string> = {
      Article: 'chip--info',
      Walkthrough: 'chip--success',
      QuickRef: 'chip--muted',
      Quiz: 'chip--warning',
    };
    return classes[type] ?? 'chip--muted';
  }
}
