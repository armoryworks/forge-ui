import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { AdminService } from '../../services/admin.service';
import { ComplianceFormTemplate, ComplianceFormType } from '../../../account/models/compliance-form.model';
import { ComplianceTemplateDialogComponent } from '../compliance-template-dialog/compliance-template-dialog.component';
import { StateWithholdingDialogComponent } from '../state-withholding-dialog/state-withholding-dialog.component';

const SYSTEM_FORM_TYPES: Set<ComplianceFormType> = new Set([
  'W4', 'I9', 'StateWithholding', 'DirectDeposit', 'WorkersComp', 'Handbook',
]);

@Component({
  selector: 'app-compliance-templates-panel',
  standalone: true,
  imports: [DatePipe, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './compliance-templates-panel.component.html',
  styleUrl: './compliance-templates-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceTemplatesPanelComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly templates = signal<ComplianceFormTemplate[]>([]);
  protected readonly loading = signal(false);
  protected readonly syncing = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'icon', header: '', width: '40px' },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'formType', header: 'Type', sortable: true, filterable: true, type: 'enum',
      filterOptions: [
        { value: 'W4', label: 'W-4' },
        { value: 'I9', label: 'I-9' },
        { value: 'StateWithholding', label: 'State Withholding' },
        { value: 'DirectDeposit', label: 'Direct Deposit' },
        { value: 'WorkersComp', label: 'Workers Comp' },
        { value: 'Handbook', label: 'Handbook' },
      ],
      width: '160px',
    },
    { field: 'isAutoSync', header: 'Auto-Sync', sortable: true, width: '100px' },
    { field: 'lastSyncedAt', header: 'Last Synced', sortable: true, type: 'date', width: '140px' },
    { field: 'isActive', header: 'Active', sortable: true, width: '80px' },
    { field: 'actions', header: '', width: '120px' },
  ];

  ngOnInit(): void {
    this.loadTemplates();
  }

  protected loadTemplates(): void {
    this.loading.set(true);
    this.adminService.getComplianceTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreateDialog(): void {
    this.dialog.open(ComplianceTemplateDialogComponent, {
      width: '520px',
      data: null,
    }).afterClosed().subscribe((result) => {
      if (result) this.loadTemplates();
    });
  }

  protected onRowClick(template: ComplianceFormTemplate): void {
    if (template.formType === 'StateWithholding') {
      this.openStateWithholdingDialog();
    } else {
      this.openEditDialog(template);
    }
  }

  protected openEditDialog(template: ComplianceFormTemplate): void {
    this.dialog.open(ComplianceTemplateDialogComponent, {
      width: '520px',
      data: template,
    }).afterClosed().subscribe((result) => {
      if (result) this.loadTemplates();
    });
  }

  protected openStateWithholdingDialog(): void {
    this.dialog.open(StateWithholdingDialogComponent, {
      width: '720px',
    }).afterClosed().subscribe((result) => {
      if (result) this.loadTemplates();
    });
  }

  protected deleteTemplate(template: ComplianceFormTemplate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Template?',
        message: `This will deactivate "${template.name}". Existing submissions will be preserved.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.adminService.deleteComplianceTemplate(template.id).subscribe({
          next: () => {
            this.snackbar.success('Template deleted');
            this.loadTemplates();
          },
        });
      }
    });
  }

  protected isSystemTemplate(template: ComplianceFormTemplate): boolean {
    return SYSTEM_FORM_TYPES.has(template.formType);
  }

  protected syncTemplate(template: ComplianceFormTemplate): void {
    this.adminService.syncComplianceTemplate(template.id).subscribe({
      next: () => {
        this.snackbar.success(`Synced "${template.name}"`);
        this.loadTemplates();
      },
    });
  }

  protected syncAll(): void {
    this.syncing.set(true);
    this.adminService.syncAllComplianceTemplates().subscribe({
      next: () => {
        this.syncing.set(false);
        this.snackbar.success('All auto-sync templates synced');
        this.loadTemplates();
      },
      error: () => this.syncing.set(false),
    });
  }
}
