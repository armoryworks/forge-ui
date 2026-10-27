import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PpapService } from '../../services/ppap.service';
import { PpapSubmission } from '../../models/ppap-submission.model';
import { PPAP_STATUSES, PPAP_STATUS_CHIP, PpapStatus } from '../../models/ppap-status.model';
import { PPAP_AUTHOR_ROLES } from '../../models/ppap-roles.model';
import { PpapCreateDialogComponent } from '../../components/ppap-create-dialog/ppap-create-dialog.component';
import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { AuthService } from '../../../../../shared/services/auth.service';
import { DateOnlyPipe } from '../../../../../shared/pipes/date-only.pipe';

@Component({
  selector: 'app-ppap-list',
  standalone: true,
  imports: [DateOnlyPipe, ReactiveFormsModule, TranslatePipe, PageHeaderComponent, DataTableComponent, SelectComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './ppap-list.component.html',
  styleUrl: './ppap-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PpapListComponent {
  private readonly ppapService = inject(PpapService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  protected readonly canAuthor = this.auth.hasAnyRole(PPAP_AUTHOR_ROLES);
  protected readonly loading = signal(false);
  protected readonly submissions = signal<PpapSubmission[]>([]);
  protected readonly statusFilter = new FormControl<PpapStatus | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    ...PPAP_STATUSES.map(s => ({ value: s, label: this.translate.instant(`ppap.status${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'submissionNumber', header: this.translate.instant('ppap.colNumber'), sortable: true, width: '120px' },
    { field: 'partNumber', header: this.translate.instant('common.part'), sortable: true },
    { field: 'customerName', header: this.translate.instant('common.customer'), sortable: true },
    { field: 'ppapLevel', header: this.translate.instant('ppap.level'), sortable: true, type: 'number', align: 'center', width: '70px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'progress', header: this.translate.instant('ppap.colProgress'), width: '120px', align: 'center', sortValue: row => (row as PpapSubmission).completedElements },
    { field: 'dueDate', header: this.translate.instant('common.dueDate'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.ppapService.list({ status: this.statusFilter.value ?? undefined }).subscribe({
      next: list => {
        this.submissions.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusChip(status: PpapStatus): string {
    return `chip ${PPAP_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected open(row: unknown): void {
    this.router.navigate(['/quality/ppap', (row as PpapSubmission).id]);
  }

  protected openCreate(): void {
    this.dialog.open<PpapCreateDialogComponent, undefined, PpapSubmission | undefined>(PpapCreateDialogComponent, { width: '560px' })
      .afterClosed().subscribe(created => {
        if (created) this.router.navigate(['/quality/ppap', created.id]);
      });
  }
}
