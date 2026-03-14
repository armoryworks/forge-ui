import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { AdminService } from '../../services/admin.service';
import { AiAssistant } from '../../models/ai-assistant.model';
import { AiAssistantDialogComponent } from '../ai-assistant-dialog/ai-assistant-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-ai-assistants-panel',
  standalone: true,
  imports: [
    DataTableComponent, ColumnCellDirective, EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './ai-assistants-panel.component.html',
  styleUrl: './ai-assistants-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantsPanelComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly assistants = signal<AiAssistant[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'icon', header: '', width: '40px' },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'category', header: 'Category', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'General', label: 'General' },
      { value: 'HR', label: 'HR' },
      { value: 'Procurement', label: 'Procurement' },
      { value: 'Sales', label: 'Sales' },
      { value: 'Custom', label: 'Custom' },
    ]},
    { field: 'entityTypes', header: 'Entity Filters', sortable: false, width: '140px' },
    { field: 'status', header: 'Status', sortable: true, width: '100px' },
    { field: 'actions', header: 'Actions', width: '100px', align: 'right' },
  ];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.adminService.getAiAssistants().subscribe({
      next: (data) => { this.assistants.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snackbar.error('Failed to load AI assistants'); },
    });
  }

  protected openCreate(): void {
    this.dialog.open(AiAssistantDialogComponent, {
      width: '720px',
      data: { assistant: null },
    }).afterClosed().subscribe((result) => {
      if (result) this.load();
    });
  }

  protected openEdit(assistant: AiAssistant): void {
    this.dialog.open(AiAssistantDialogComponent, {
      width: '720px',
      data: { assistant },
    }).afterClosed().subscribe((result) => {
      if (result) this.load();
    });
  }

  protected deleteAssistant(assistant: AiAssistant): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete AI Assistant?',
        message: `This will deactivate "${assistant.name}". This action cannot be undone for built-in assistants.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.deleteAiAssistant(assistant.id).subscribe({
        next: () => { this.load(); this.snackbar.success('Assistant deleted'); },
        error: () => this.snackbar.error('Failed to delete assistant'),
      });
    });
  }
}
