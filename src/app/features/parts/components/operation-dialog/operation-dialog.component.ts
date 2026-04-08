import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { Operation, OperationMaterial } from '../../models/operation.model';
import { BOMEntry } from '../../models/bom-entry.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { ActivityTimelineComponent } from '../../../../shared/components/activity-timeline/activity-timeline.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FileAttachment } from '../../../../shared/models/file.model';
import { ActivityItem } from '../../../../shared/models/activity.model';
import { environment } from '../../../../../environments/environment';

export type OperationTab = 'details' | 'materials' | 'files' | 'activity';

export interface OperationDialogData {
  partId: number;
  operation?: Operation;
  nextStepNumber?: number;
  operations?: Operation[];
  bomEntries?: BOMEntry[];
}

@Component({
  selector: 'app-operation-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    ToggleComponent, EntityPickerComponent, FileUploadZoneComponent,
    ActivityTimelineComponent, EmptyStateComponent,
    ValidationPopoverDirective,
    TranslatePipe,
  ],
  templateUrl: './operation-dialog.component.html',
  styleUrl: './operation-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly partsService = inject(PartsService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly matDialogRef = inject(MatDialogRef<OperationDialogComponent>);
  protected readonly data = inject<OperationDialogData>(MAT_DIALOG_DATA);

  protected readonly isEditMode = !!this.data.operation;
  protected readonly activeTab = signal<OperationTab>('details');
  protected readonly saving = signal(false);
  protected readonly addingMaterial = signal(false);
  protected readonly addingComment = signal(false);

  protected readonly materials = signal<OperationMaterial[]>(this.data.operation?.materials ?? []);
  protected readonly files = signal<FileAttachment[]>([]);
  protected readonly activities = signal<ActivityItem[]>([]);

  protected readonly draftConfig: DraftConfig = {
    entityType: 'operation',
    entityId: this.data.operation?.id?.toString() ?? 'new',
    route: '/parts',
  };

  protected readonly formGroup = new FormGroup({
    stepNumber: new FormControl<number>(this.data.operation?.stepNumber ?? this.data.nextStepNumber ?? 1, [Validators.required, Validators.min(1)]),
    title: new FormControl(this.data.operation?.title ?? '', [Validators.required, Validators.maxLength(200)]),
    instructions: new FormControl(this.data.operation?.instructions ?? ''),
    workCenterId: new FormControl<number | null>(this.data.operation?.workCenterId ?? null),
    estimatedMinutes: new FormControl<number | null>(this.data.operation?.estimatedMinutes ?? null, [Validators.min(1)]),
    isQcCheckpoint: new FormControl(this.data.operation?.isQcCheckpoint ?? false),
    qcCriteria: new FormControl(this.data.operation?.qcCriteria ?? ''),
    referencedOperationId: new FormControl<number | null>(this.data.operation?.referencedOperationId ?? null),
  });

  protected readonly violations = FormValidationService.getViolations(this.formGroup, {
    stepNumber: this.translate.instant('parts.stepNumber'),
    title: this.translate.instant('common.title'),
    estimatedMinutes: this.translate.instant('parts.estMinutes'),
  });

  // Other operations in the same routing (for cross-reference select)
  protected readonly otherOperationOptions = computed<SelectOption[]>(() => {
    const ops = this.data.operations ?? [];
    const currentId = this.data.operation?.id;
    const filtered = ops.filter(o => o.id !== currentId);
    return [
      { value: null, label: this.translate.instant('kanban.noneOption') },
      ...filtered.map(o => ({ value: o.id, label: `Op ${o.stepNumber}: ${o.title}` })),
    ];
  });

  // BOM entries available for material assignment
  protected readonly bomEntryOptions = computed<SelectOption[]>(() => {
    const entries = this.data.bomEntries ?? [];
    const assignedIds = new Set(this.materials().map(m => m.bomEntryId));
    return entries
      .filter(e => !assignedIds.has(e.id))
      .map(e => ({ value: e.id, label: `${e.childPartNumber} — ${e.childDescription}` }));
  });

  // Add material form controls
  protected readonly newMaterialBomEntryId = new FormControl<number | null>(null);
  protected readonly newMaterialQuantity = new FormControl<number>(1);

  // Comment control
  protected readonly commentControl = new FormControl('');

  ngOnInit(): void {
    if (this.isEditMode) {
      this.loadFiles();
      this.loadActivity();
    }
  }

  private loadFiles(): void {
    const opId = this.data.operation!.id;
    this.partsService.getOperationFiles(this.data.partId, opId).subscribe({
      next: (files) => this.files.set(files),
    });
  }

  private loadActivity(): void {
    const opId = this.data.operation!.id;
    this.partsService.getOperationActivity(this.data.partId, opId).subscribe({
      next: (activities) => this.activities.set(activities),
    });
  }

  protected save(): void {
    if (this.formGroup.invalid) return;
    this.saving.set(true);

    const raw = this.formGroup.getRawValue();

    if (this.data.operation) {
      this.partsService.updateOperation(this.data.partId, this.data.operation.id, {
        stepNumber: raw.stepNumber ?? undefined,
        title: raw.title ?? undefined,
        instructions: raw.instructions || undefined,
        workCenterId: raw.workCenterId ?? undefined,
        estimatedMinutes: raw.estimatedMinutes ?? undefined,
        isQcCheckpoint: raw.isQcCheckpoint ?? undefined,
        qcCriteria: raw.qcCriteria || undefined,
        referencedOperationId: raw.referencedOperationId ?? 0,
      }).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.matDialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.partsService.createOperation(this.data.partId, {
        stepNumber: raw.stepNumber!,
        title: raw.title!,
        instructions: raw.instructions || undefined,
        workCenterId: raw.workCenterId ?? undefined,
        estimatedMinutes: raw.estimatedMinutes ?? undefined,
        isQcCheckpoint: raw.isQcCheckpoint ?? false,
        qcCriteria: raw.qcCriteria || undefined,
        referencedOperationId: raw.referencedOperationId ?? undefined,
      }).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.matDialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected addMaterial(): void {
    const bomEntryId = this.newMaterialBomEntryId.value;
    const quantity = this.newMaterialQuantity.value ?? 1;
    if (!bomEntryId) return;

    this.addingMaterial.set(true);
    this.partsService.createOperationMaterial(this.data.partId, this.data.operation!.id, {
      bomEntryId,
      quantity,
    }).subscribe({
      next: (mat) => {
        this.materials.update(list => [...list, mat]);
        this.newMaterialBomEntryId.reset();
        this.newMaterialQuantity.setValue(1);
        this.addingMaterial.set(false);
        this.snackbar.success(this.translate.instant('parts.materialAdded'));
      },
      error: () => this.addingMaterial.set(false),
    });
  }

  protected removeMaterial(mat: OperationMaterial): void {
    this.partsService.deleteOperationMaterial(this.data.partId, this.data.operation!.id, mat.id).subscribe(() => {
      this.materials.update(list => list.filter(m => m.id !== mat.id));
      this.snackbar.success(this.translate.instant('parts.materialRemoved'));
    });
  }

  protected onFileUploaded(file: UploadedFile): void {
    this.files.update(list => [...list, { ...file, id: parseInt(file.id, 10) } as unknown as FileAttachment]);
  }

  protected deleteFile(file: FileAttachment): void {
    this.partsService.deleteOperationFile(file.id).subscribe(() => {
      this.files.update(list => list.filter(f => f.id !== file.id));
      this.snackbar.success(this.translate.instant('parts.fileDeleted'));
    });
  }

  protected addComment(): void {
    const text = this.commentControl.value?.trim();
    if (!text) return;

    this.addingComment.set(true);
    this.partsService.addOperationComment(this.data.partId, this.data.operation!.id, text).subscribe({
      next: () => {
        this.commentControl.reset();
        this.addingComment.set(false);
        this.loadActivity();
      },
      error: () => this.addingComment.set(false),
    });
  }

  protected isImage(file: FileAttachment): boolean {
    return file.contentType?.startsWith('image/') ?? false;
  }

  protected isVideo(file: FileAttachment): boolean {
    return file.contentType?.startsWith('video/') ?? false;
  }

  protected getFileUrl(fileId: number): string {
    return `${environment.apiUrl}/files/${fileId}/download`;
  }
}
