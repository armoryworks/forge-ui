import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { QcTemplate } from '../../models/qc-template.model';
import { QcTemplateItem } from '../../models/qc-template-item.model';
import { QualityService } from '../../services/quality.service';

export interface QcTemplateEditorDialogData {
  template: QcTemplate | null;
}

type ItemGroup = FormGroup<{
  id: FormControl<number | null>;
  description: FormControl<string>;
  specification: FormControl<string>;
  isRequired: FormControl<boolean>;
}>;

@Component({
  selector: 'app-qc-template-editor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, EntityPickerComponent, InputComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './qc-template-editor-dialog.component.html',
  styleUrl: './qc-template-editor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QcTemplateEditorDialogComponent implements AfterViewInit {
  private readonly ref = inject(MatDialogRef<QcTemplateEditorDialogComponent, QcTemplate | undefined>);
  private readonly data = inject<QcTemplateEditorDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(QualityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  private readonly partPicker = viewChild<EntityPickerComponent>('partPicker');

  protected readonly editing = this.data.template;
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl(this.editing?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl(this.editing?.description ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    partId: new FormControl<number | null>(this.editing?.partId ?? null),
    items: new FormArray<ItemGroup>(
      [...(this.editing?.items ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(item => this.itemGroup(item)),
    ),
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly violations = computed<string[]>(() => {
    const value = this.formValue();
    const out: string[] = [];
    if (!value.name.trim()) {
      out.push(this.translate.instant('qcInspections.nameRequired'));
    }
    if (value.items.length === 0) {
      out.push(this.translate.instant('qcInspections.noItems'));
    }
    value.items.forEach((item, index) => {
      if (!item.description.trim()) {
        out.push(this.translate.instant('qcInspections.itemDescriptionRequired', { n: index + 1 }));
      }
    });
    return out;
  });

  protected readonly canSave = computed(() => this.violations().length === 0 && !this.saving());

  protected get items(): FormArray<ItemGroup> {
    return this.form.controls.items;
  }

  ngAfterViewInit(): void {
    const template = this.editing;
    if (template?.partId != null && template.partNumber) {
      this.partPicker()?.setSelected(template.partId, template.partNumber);
    }
  }

  protected addItem(): void {
    this.items.push(this.itemGroup());
  }

  protected removeItem(index: number): void {
    this.items.removeAt(index);
  }

  protected moveItem(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.items.length) return;
    const control = this.items.at(index);
    this.items.removeAt(index);
    this.items.insert(target, control);
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      partId: value.partId ?? undefined,
      items: value.items.map((item, index) => ({
        ...(item.id != null ? { id: item.id } : {}),
        description: item.description.trim(),
        specification: item.specification.trim() || undefined,
        sortOrder: index,
        isRequired: item.isRequired,
      })),
    };
    const request = this.editing
      ? this.service.updateTemplate(this.editing.id, payload)
      : this.service.createTemplate(payload);
    request.subscribe({
      next: saved => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('qcInspections.templateSaved'));
        this.ref.close(saved);
      },
      error: () => this.saving.set(false),
    });
  }

  protected cancel(): void {
    this.ref.close();
  }

  private itemGroup(item?: QcTemplateItem): ItemGroup {
    return new FormGroup({
      id: new FormControl<number | null>(item?.id ?? null),
      description: new FormControl(item?.description ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
      specification: new FormControl(item?.specification ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
      isRequired: new FormControl(item?.isRequired ?? true, { nonNullable: true }),
    });
  }
}
