import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { IcpRubricService } from '../services/icp-rubric.service';
import { IcpRubric, IcpRubricDetail } from '../models/icp-rubric.model';
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
 * Phase 1r / Batch 10 — admin CRUD for the ICP rubric catalog.
 *
 * Edit-rubric dialog manages both the rubric header (name / description /
 * active / default) AND its dimensions in a single save. Dimensions are
 * inline rows in a FormArray; admins typically tune several at once and
 * we want one round-trip + one rolled-up activity entry. The save is two
 * sequential PUTs — header first, then dimensions — so the server's
 * single-default invariant on `IsDefault` doesn't fight the dimension
 * upsert.
 */
@Component({
  selector: 'app-icp-rubrics',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, TextareaComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './icp-rubrics.component.html',
  styleUrl: './icp-rubrics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IcpRubricsComponent {
  private readonly service = inject(IcpRubricService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rubrics = signal<IcpRubric[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('admin.icpRubrics.colName'), sortable: true },
    { field: 'description', header: this.translate.instant('admin.icpRubrics.colDescription'), sortable: true },
    { field: 'dimensionCount', header: this.translate.instant('admin.icpRubrics.colDimensions'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'isDefault', header: this.translate.instant('admin.icpRubrics.colDefault'), sortable: true, width: '90px', align: 'center' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
    { field: 'createdAt', header: this.translate.instant('admin.icpRubrics.colCreated'), sortable: true, type: 'date', width: '110px' },
    { field: 'actions', header: '', width: '110px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
    isDefault: new FormControl<boolean>(false, { nonNullable: true }),
    dimensions: new FormArray<FormGroup>([]),
  });

  protected get dimensions(): FormArray<FormGroup> {
    return this.form.controls.dimensions;
  }

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('admin.icpRubrics.fieldName'),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.rubrics.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openNew(): void {
    this.editingId.set(null);
    this.dimensions.clear();
    this.form.reset({ name: '', description: '', isActive: true, isDefault: false });
    this.showDialog.set(true);
  }

  protected openEdit(row: IcpRubric): void {
    this.editingId.set(row.id);
    this.service.getById(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail: IcpRubricDetail) => {
        this.dimensions.clear();
        for (const d of detail.dimensions) {
          this.dimensions.push(this.buildDimensionForm(d.id, d.fieldKey, d.label, d.matchSpec, d.weight));
        }
        this.form.reset({
          name: detail.name,
          description: detail.description ?? '',
          isActive: detail.isActive,
          isDefault: detail.isDefault,
          dimensions: this.dimensions.value as never,
        });
        this.showDialog.set(true);
      },
    });
  }

  private buildDimensionForm(id: number | null, fieldKey: string, label: string | null, matchSpec: string | null, weight: number): FormGroup {
    return new FormGroup({
      id: new FormControl<number | null>(id),
      fieldKey: new FormControl<string>(fieldKey, { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
      label: new FormControl<string>(label ?? '', { nonNullable: true, validators: [Validators.maxLength(120)] }),
      matchSpec: new FormControl<string>(matchSpec ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
      weight: new FormControl<number>(weight, { nonNullable: true, validators: [Validators.required] }),
    });
  }

  protected addDimension(): void {
    this.dimensions.push(this.buildDimensionForm(null, '', null, null, 5));
    this.form.markAsDirty();
  }

  protected removeDimension(idx: number): void {
    this.dimensions.removeAt(idx);
    this.form.markAsDirty();
  }

  protected close(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const id = this.editingId();

    const dimsPayload = this.dimensions.controls.map(c => {
      const v = c.getRawValue() as { id: number | null; fieldKey: string; label: string; matchSpec: string; weight: number };
      return {
        id: v.id,
        fieldKey: v.fieldKey.trim(),
        label: v.label.trim() || null,
        matchSpec: v.matchSpec.trim() || null,
        weight: v.weight,
      };
    });

    if (id !== null) {
      // Update header, then upsert dimensions, then close.
      this.service.update(id, {
        name: f.name.trim(),
        description: f.description.trim() || null,
        isActive: f.isActive,
        isDefault: f.isDefault,
      }).subscribe({
        next: () => {
          this.service.saveDimensions(id, dimsPayload).subscribe({
            next: () => {
              this.saving.set(false);
              this.snackbar.success(this.translate.instant('admin.icpRubrics.updated'));
              this.close();
              this.load();
            },
            error: () => this.saving.set(false),
          });
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.service.create({
        name: f.name.trim(),
        description: f.description.trim() || null,
      }).subscribe({
        next: (created) => {
          // Persist dimensions + default-flag flip on the freshly created rubric.
          this.service.saveDimensions(created.id, dimsPayload).subscribe({
            next: () => {
              if (f.isDefault) {
                this.service.update(created.id, { isActive: true, isDefault: true }).subscribe({
                  next: () => this.finishCreate(),
                  error: () => this.saving.set(false),
                });
              } else {
                this.finishCreate();
              }
            },
            error: () => this.saving.set(false),
          });
        },
        error: () => this.saving.set(false),
      });
    }
  }

  private finishCreate(): void {
    this.saving.set(false);
    this.snackbar.success(this.translate.instant('admin.icpRubrics.created'));
    this.close();
    this.load();
  }

  protected confirmDelete(row: IcpRubric): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('admin.icpRubrics.deleteTitle'),
        message: this.translate.instant('admin.icpRubrics.deleteMessage', { name: row.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.icpRubrics.deleted'));
          this.load();
        },
      });
    });
  }
}
