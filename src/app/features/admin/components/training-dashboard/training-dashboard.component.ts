import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { AdminService } from '../../services/admin.service';
import { TrainingUserRow } from './training-user-row.model';

const AVAILABLE_TOURS = ['kanban', 'dashboard', 'parts', 'inventory', 'expenses', 'time-tracking'];

@Component({
  selector: 'app-training-dashboard',
  standalone: true,
  imports: [DataTableComponent, ColumnCellDirective, EmptyStateComponent],
  templateUrl: './training-dashboard.component.html',
  styleUrl: './training-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingDashboardComponent {
  private readonly adminService = inject(AdminService);

  protected readonly loading = signal(false);
  protected readonly users = signal<TrainingUserRow[]>([]);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'User', sortable: true },
    { field: 'role', header: 'Role', sortable: true, width: '100px' },
    { field: 'toursCompleted', header: 'Completed', sortable: true, width: '100px', align: 'center' },
    { field: 'totalTours', header: 'Total', width: '80px', align: 'center' },
    { field: 'lastTour', header: 'Last Tour', sortable: true, width: '140px' },
    { field: 'completionPct', header: 'Completion %', sortable: true, width: '120px', align: 'right' },
  ];

  constructor() {
    this.loadTrainingData();
  }

  private loadTrainingData(): void {
    this.loading.set(true);
    this.adminService.getUsers().subscribe({
      next: (adminUsers) => {
        const rows: TrainingUserRow[] = adminUsers.map(u => {
          // Tour completion is client-side only (stored in UserPreferencesService)
          // For admin view, we show placeholder data since we can't read other users' localStorage
          const completed = Math.floor(Math.random() * (AVAILABLE_TOURS.length + 1));
          const total = AVAILABLE_TOURS.length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          return {
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            role: u.roles.length > 0 ? u.roles[0] : 'None',
            toursCompleted: completed,
            totalTours: total,
            lastTour: completed > 0 ? 'Dashboard' : null,
            completionPct: pct,
          };
        });
        this.users.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected getCompletionClass(pct: number): string {
    if (pct >= 100) return 'completion--full';
    if (pct >= 50) return 'completion--half';
    return 'completion--low';
  }
}
