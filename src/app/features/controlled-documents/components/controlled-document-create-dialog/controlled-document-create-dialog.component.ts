import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { distinctUntilChanged, of, switchMap } from 'rxjs';

import { ControlledDocumentService } from '../../services/controlled-document.service';
import { ControlledDocument } from '../../models/controlled-document.model';
import { CONTROLLED_DOCUMENT_CATEGORIES, ControlledDocumentCategory } from '../../models/controlled-document-category.model';
import { PartsService } from '../../../parts/services/parts.service';
import { Operation } from '../../../parts/models/operation.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-controlled-document-create-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, TextareaComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './controlled-document-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlledDocumentCreateDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ControlledDocumentCreateDialogComponent, ControlledDocument | undefined>);
  private readonly documentService = inject(ControlledDocumentService);
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);

  protected readonly categoryOptions: SelectOption[] = CONTROLLED_DOCUMENT_CATEGORIES.map(c => ({
    value: c, label: this.translate.instant(`controlledDocuments.category${c}`),
  }));

  protected readonly form = new FormGroup({
    title: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(300), Validators.pattern(/\S/)] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    category: new FormControl<ControlledDocumentCategory>('WI', { nonNullable: true, validators: [Validators.required] }),
    reviewIntervalDays: new FormControl<number | null>(365, [Validators.required, Validators.min(1), Validators.max(3650)]),
    partId: new FormControl<number | null>(null),
    operationId: new FormControl<number | null>(null),
  });

  private readonly operations = toSignal(
    this.form.controls.partId.valueChanges.pipe(
      distinctUntilChanged(),
      switchMap(partId => {
        this.form.controls.operationId.setValue(null);
        return partId ? this.partsService.getOperations(partId) : of([] as Operation[]);
      }),
    ),
    { initialValue: [] as Operation[] },
  );

  protected readonly operationOptions = (): SelectOption[] => [
    { value: null, label: this.translate.instant('controlledDocuments.anyOperation') },
    ...this.operations().map(o => ({ value: o.id, label: `${o.stepNumber} — ${o.title}` })),
  ];

  protected readonly violations = FormValidationService.getViolations(this.form, {
    title: this.translate.instant('common.title'),
    description: this.translate.instant('common.description'),
    category: this.translate.instant('common.category'),
    reviewIntervalDays: this.translate.instant('controlledDocuments.reviewIntervalDays'),
    partId: this.translate.instant('common.part'),
    operationId: this.translate.instant('controlledDocuments.operation'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.documentService.create({
      title: v.title.trim(),
      description: v.description.trim() || null,
      category: v.category,
      reviewIntervalDays: v.reviewIntervalDays ?? 365,
      partId: v.partId,
      operationId: v.operationId,
    }).subscribe({
      next: created => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('controlledDocuments.created'));
        this.dialogRef.close(created);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'controlledDocuments.saveFailed');
      },
    });
  }
}
