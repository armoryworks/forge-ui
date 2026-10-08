import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ReferenceDataItem } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CreateMaterialSpecRequest } from '../../models/create-material-spec-request.model';
import { MaterialSpecService } from '../../services/material-spec.service';

export interface MaterialSpecDialogData {
  items: ReferenceDataItem[];
}

export const NEW_MATERIAL_CATEGORY = 'new';

type CategoryValue = number | typeof NEW_MATERIAL_CATEGORY | null;

@Component({
  selector: 'app-material-spec-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './material-spec-dialog.component.html',
  styleUrl: './material-spec-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialSpecDialogComponent {
  private readonly materialSpecs = inject(MaterialSpecService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<MaterialSpecDialogComponent, ReferenceDataItem | null>);
  private readonly data = inject<MaterialSpecDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  private readonly parentIds = new Set(this.data.items.map(i => i.parentId).filter(id => id != null));

  protected readonly categoryOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('materialSpecs.noCategory') },
    ...this.data.items
      .filter(i => i.isActive && i.parentId == null && this.parentIds.has(i.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(i => ({ value: i.id, label: i.label })),
    { value: NEW_MATERIAL_CATEGORY, label: this.translate.instant('materialSpecs.newCategory') },
  ];

  protected readonly form = new FormGroup({
    category: new FormControl<CategoryValue>(null),
    newCategoryLabel: new FormControl<string>(
      { value: '', disabled: true },
      { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] },
    ),
    label: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
  });

  private readonly category = toSignal(this.form.controls.category.valueChanges, {
    initialValue: this.form.controls.category.value,
  });
  protected readonly creatingCategory = computed(() => this.category() === NEW_MATERIAL_CATEGORY);

  protected readonly violations = FormValidationService.getViolations(this.form, {
    newCategoryLabel: this.translate.instant('materialSpecs.newCategoryName'),
    label: this.translate.instant('materialSpecs.name'),
  });

  constructor() {
    this.form.controls.category.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      const control = this.form.controls.newCategoryLabel;
      if (value === NEW_MATERIAL_CATEGORY) control.enable();
      else control.disable();
    });
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const request = this.buildRequest();
    if (!request) return;
    this.saving.set(true);
    this.materialSpecs.create(request).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('materialSpecs.created', { name: created.label }));
        this.dialogRef.close(created);
      },
      error: () => this.saving.set(false),
    });
  }

  private buildRequest(): CreateMaterialSpecRequest | null {
    const v = this.form.getRawValue();
    const label = v.label.trim();
    if (!label) return null;
    if (v.category === NEW_MATERIAL_CATEGORY) {
      const newCategoryLabel = v.newCategoryLabel.trim();
      return newCategoryLabel ? { label, newCategoryLabel } : null;
    }
    return v.category == null ? { label } : { label, parentId: v.category };
  }
}
