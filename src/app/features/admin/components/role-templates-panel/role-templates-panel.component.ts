import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AdminService } from '../../services/admin.service';
import { RoleTemplate } from '../../models/role-template.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';

/**
 * Phase 3 / WU-06 / C1 — Tenant-side CRUD over role templates (rollups).
 *
 * Mirrors the existing teams-panel pattern: data-table on top, edit dialog
 * keyed off `editingTemplate()`, system-default rows are read-only with a
 * tooltip explaining why.
 */
@Component({
  selector: 'app-role-templates-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DataTableComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
    DialogComponent,
    InputComponent,
    TextareaComponent,
    SelectComponent,
    ValidationButtonComponent,
    MatTooltipModule,
  ],
  templateUrl: './role-templates-panel.component.html',
  styleUrl: './role-templates-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleTemplatesPanelComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly templates = signal<RoleTemplate[]>([]);
  protected readonly roleOptions = signal<SelectOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly showDialog = signal(false);
  protected readonly editingTemplate = signal<RoleTemplate | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    description: new FormControl<string | null>(null, [Validators.maxLength(500)]),
    includedRoleNames: new FormControl<string[]>([], [Validators.required]),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Template Name',
    includedRoleNames: 'Included Roles',
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'description', header: 'Description', sortable: false },
    { field: 'includedRoleNames', header: 'Included Roles', sortable: false },
    { field: 'assigneeCount', header: 'Assignees', sortable: true, width: '110px', align: 'center' },
    { field: 'isSystemDefault', header: 'Source', sortable: true, width: '110px' },
    { field: 'actions', header: 'Actions', width: '140px', align: 'right' },
  ];

  ngOnInit(): void {
    this.load();
    this.refDataService.getRolesAsOptions().subscribe(opts => this.roleOptions.set(opts));
  }

  protected load(): void {
    this.loading.set(true);
    this.adminService.getRoleTemplates().subscribe({
      next: (templates) => { this.templates.set(templates); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.snackbar.error('Failed to load role templates.');
      },
    });
  }

  protected openCreate(): void {
    this.editingTemplate.set(null);
    this.form.reset({ name: '', description: null, includedRoleNames: [] });
    this.showDialog.set(true);
  }

  protected openEdit(template: RoleTemplate): void {
    if (template.isSystemDefault) {
      this.snackbar.error('System-default templates cannot be edited. Create a new template to customize.');
      return;
    }
    this.editingTemplate.set(template);
    this.form.patchValue({
      name: template.name,
      description: template.description,
      includedRoleNames: [...template.includedRoleNames],
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    const form = this.form.getRawValue();
    const editing = this.editingTemplate();
    this.saving.set(true);

    const payload = {
      name: form.name!,
      description: form.description ?? null,
      includedRoleNames: form.includedRoleNames ?? [],
    };

    const obs = editing
      ? this.adminService.updateRoleTemplate(editing.id, { id: editing.id, ...payload })
      : this.adminService.createRoleTemplate(payload);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.load();
        this.snackbar.success(editing ? 'Template updated.' : 'Template created.');
      },
      error: (err) => {
        this.saving.set(false);
        const detail = err?.error?.detail ?? err?.error?.title ?? 'Save failed.';
        this.snackbar.error(detail);
      },
    });
  }

  protected delete(template: RoleTemplate): void {
    if (template.isSystemDefault) {
      this.snackbar.error('System-default templates cannot be deleted.');
      return;
    }
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete Role Template?',
        message: `This will deactivate "${template.name}" and unassign all ${template.assigneeCount} user(s) currently using it. ` +
                 `Their underlying Identity roles are unaffected.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.deleteRoleTemplate(template.id).subscribe({
        next: () => { this.load(); this.snackbar.success('Template deleted.'); },
        error: () => this.snackbar.error('Delete failed.'),
      });
    });
  }
}
