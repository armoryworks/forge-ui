import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LeadSourceService } from '../services/lead-source.service';
import { LeadSource } from '../models/lead-source.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Phase 1r / Batch 9 — admin CRUD for the LeadSource catalog.
 *
 * Code is set at create time (immutable — referenced by import pipelines and
 * referrer URLs); Name + Description + IsActive are admin-editable. Quality
 * score is owned by the nightly recompute job, not this surface.
 *
 * Sources with linked leads cannot be deleted — the server returns 400 and
 * the admin must deactivate instead so historical attribution survives.
 */
@Component({
  selector: 'app-lead-sources',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, TextareaComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './lead-sources.component.html',
  styleUrl: './lead-sources.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadSourcesComponent {
  private readonly service = inject(LeadSourceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sources = signal<LeadSource[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'code', header: 'Code', sortable: true, width: '160px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'qualityScore', header: 'Quality', sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'leadCount', header: 'Leads', sortable: true, type: 'number', align: 'right', width: '80px' },
    { field: 'isActive', header: 'Active', sortable: true, width: '90px', align: 'center' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
    { field: 'actions', header: '', width: '110px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-z0-9_-]+$/i)] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('admin.leadSources.fieldName'),
    code: this.translate.instant('admin.leadSources.fieldCode'),
    description: this.translate.instant('admin.leadSources.fieldDescription'),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.sources.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openNew(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', code: '', description: '', isActive: true });
    this.form.controls.code.enable();
    this.showDialog.set(true);
  }

  protected openEdit(row: LeadSource): void {
    this.editingId.set(row.id);
    this.form.reset({
      name: row.name,
      code: row.code,
      description: row.description ?? '',
      isActive: row.isActive,
    });
    // Code is the natural key — immutable after create.
    this.form.controls.code.disable();
    this.showDialog.set(true);
  }

  protected close(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const id = this.editingId();

    if (id !== null) {
      this.service.update(id, {
        name: f.name.trim(),
        description: f.description.trim() || null,
        isActive: f.isActive,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success(this.translate.instant('admin.leadSources.updated'));
          this.close();
          this.load();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.service.create({
        name: f.name.trim(),
        code: f.code.trim(),
        description: f.description.trim() || null,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success(this.translate.instant('admin.leadSources.created'));
          this.close();
          this.load();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected confirmDelete(row: LeadSource): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('admin.leadSources.deleteTitle'),
        message: this.translate.instant('admin.leadSources.deleteMessage', { name: row.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.leadSources.deleted'));
          this.load();
        },
      });
    });
  }
}
