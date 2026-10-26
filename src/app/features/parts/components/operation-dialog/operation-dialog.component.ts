import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { Operation, OperationMaterial } from '../../models/operation.model';
import { OperationPredecessorRequest } from '../../models/operation-predecessor-request.model';
import { UpdateOperationRequest } from '../../models/update-operation-request.model';
import { defaultPredecessorIds } from '../../utils/routing-predecessors.utils';
import { describeConflicts, predecessorConflictsOf } from '../../utils/predecessor-conflicts.utils';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { BOMLine } from '../../models/bom-line.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { ActivityTimelineComponent } from '../../../../shared/components/activity-timeline/activity-timeline.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { maxDecimalsValidator } from '../../../../shared/validators/max-decimals.validator';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { AuthSrcDirective } from '../../../../shared/directives/auth-src.directive';
import { FileAttachment } from '../../../../shared/models/file.model';
import { ActivityItem } from '../../../../shared/models/activity.model';
import { environment } from '../../../../../environments/environment';
import { VendorQuickCreateDialogComponent, VendorQuickCreateDialogData } from '../../../vendors/components/vendor-quick-create-dialog/vendor-quick-create-dialog.component';
import { VendorListItem } from '../../../vendors/models/vendor-list-item.model';
import { VENDOR_MANAGE_ROLES } from '../../../vendors/vendor-roles';
import { AuthService } from '../../../../shared/services/auth.service';
import { SchedulingService } from '../../../scheduling/services/scheduling.service';
import { WorkCenter } from '../../../scheduling/models/scheduling.model';
import { WorkCenterQuickCreateDialogComponent, WorkCenterQuickCreateDialogData } from '../../../scheduling/components/work-center-quick-create-dialog/work-center-quick-create-dialog.component';
import { TabListDirective, TabDirective } from '../../../../shared/directives/tab-list.directive';
import { ScrollCueDirective } from '../../../../shared/directives/scroll-cue.directive';
import { requiredTrimmed } from '../../../../shared/validators/required-trimmed.validator';

export type OperationTab = 'details' | 'materials' | 'files' | 'activity';

export interface OperationDialogData {
  partId: number;
  operation?: Operation;
  nextStepNumber?: number;
  operations?: Operation[];
  bomLines?: BOMLine[];
}

@Component({
  selector: 'app-operation-dialog',
  standalone: true,
  imports: [
    AuthSrcDirective,
    TabListDirective,
    TabDirective,
    ScrollCueDirective,
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    ToggleComponent, EntityPickerComponent, FileUploadZoneComponent,
    ActivityTimelineComponent, EmptyStateComponent,
    ValidationButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './operation-dialog.component.html',
  styleUrl: './operation-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationDialogComponent implements OnInit {
  /** Largest setup / lot time the server's numeric(10,2) minute columns hold. */
  static readonly MAX_MINUTES = 99_999_999.99;
  /** Largest turn time the server's numeric(5,1) column holds. */
  static readonly MAX_TURN_TIME_DAYS = 9_999.9;

  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  @ViewChild('subcontractVendorPicker') protected subcontractVendorPicker?: EntityPickerComponent;

  private readonly partsService = inject(PartsService);
  private readonly schedulingService = inject(SchedulingService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly matDialog = inject(MatDialog);
  protected readonly canCreateVendor = inject(AuthService).hasAnyRole(VENDOR_MANAGE_ROLES);
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

  /** Work centers for the details-tab select. Loaded eagerly (bounded set) so
   *  the list is visible on open — the previous asset-typeahead surfaced the
   *  wrong entity and never showed a list until the user typed. */
  protected readonly workCenterOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('parts.workCenterNone') },
  ]);

  protected readonly draftConfig: DraftConfig = {
    entityType: 'operation',
    entityId: this.data.operation?.id?.toString() ?? 'new',
    route: `/parts?detail=part:${this.data.partId}`,
  };

  /** Decomposed Hours / Minutes / Seconds seeded from the canonical
   *  `estimatedMs` for edit mode. Sub-minute remainder (0–59.999) lands in `seconds`. */
  private readonly estParts = OperationDialogComponent.decomposeMs(this.data.operation?.estimatedMs ?? null);

  private readonly scrapFactorRange = (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const percent = Number(value);
    return percent >= 0 && percent < 100
      ? null
      : { scrapFactorRange: { message: this.translate.instant('parts.scrapFactorError') } };
  };

  protected readonly formGroup = new FormGroup({
    stepNumber: new FormControl<number>(this.data.operation?.stepNumber ?? this.data.nextStepNumber ?? 1, [Validators.required, Validators.min(1)]),
    title: new FormControl(this.data.operation?.title ?? '', [requiredTrimmed, Validators.maxLength(200)]),
    instructions: new FormControl(this.data.operation?.instructions ?? ''),
    workCenterId: new FormControl<number | null>(this.data.operation?.workCenterId ?? null),
    // Composable estimated time — canonically stored in milliseconds; composed on save,
    // decomposed on load. Each field is optional and non-negative.
    estHours: new FormControl<number | null>(this.estParts.hours, [Validators.min(0)]),
    estMinutes: new FormControl<number | null>(this.estParts.minutes, [Validators.min(0)]),
    estSeconds: new FormControl<number | null>(this.estParts.seconds, [Validators.min(0), Validators.max(59.999)]),
    setupMinutes: new FormControl<number | null>(this.data.operation?.setupMinutes ?? null, [
      Validators.min(0), Validators.max(OperationDialogComponent.MAX_MINUTES),
      maxDecimalsValidator(2, this.translate.instant('parts.setupTime'), this.translate),
    ]),
    runMinutesLot: new FormControl<number | null>(this.data.operation?.runMinutesLot ?? null, [
      Validators.min(0), Validators.max(OperationDialogComponent.MAX_MINUTES),
      maxDecimalsValidator(2, this.translate.instant('parts.lotTime'), this.translate),
    ]),
    scrapFactorPercent: new FormControl<number | null>(
      this.data.operation?.scrapFactor ? Math.round(this.data.operation.scrapFactor * 1_000_000) / 10_000 : null,
      [this.scrapFactorRange]),
    laborAttendancePercent: new FormControl<number | null>(this.data.operation?.laborAttendancePercent ?? 100, [
      Validators.required, Validators.min(0), Validators.max(100),
      maxDecimalsValidator(2, this.translate.instant('parts.laborAttendance'), this.translate),
    ]),
    isQcCheckpoint: new FormControl(this.data.operation?.isQcCheckpoint ?? false),
    qcCriteria: new FormControl(this.data.operation?.qcCriteria ?? ''),
    referencedOperationId: new FormControl<number | null>(this.data.operation?.referencedOperationId ?? null),
    // Phase 3 H5 / WU-13 — subcontract metadata. Server requires vendor +
    // turn-time when isSubcontract is true; the template conditionally
    // shows / hides the two dependent fields based on the toggle.
    isSubcontract: new FormControl(this.data.operation?.isSubcontract ?? false),
    subcontractVendorId: new FormControl<number | null>(this.data.operation?.subcontractVendorId ?? null),
    subcontractTurnTimeDays: new FormControl<number | null>(this.data.operation?.subcontractTurnTimeDays ?? null, [
      Validators.min(0.1), Validators.max(OperationDialogComponent.MAX_TURN_TIME_DAYS),
      maxDecimalsValidator(1, this.translate.instant('parts.subcontractTurnTimeDays'), this.translate),
    ]),
    predecessorIds: new FormControl<number[]>(this.initialPredecessorIds(), { nonNullable: true }),
    completeGateIds: new FormControl<number[]>(
      (this.data.operation?.predecessors ?? []).filter(p => p.gate === 'Complete').map(p => p.operationId), { nonNullable: true }),
    cycleCountdown: new FormControl(this.data.operation?.cycleCountdown ?? false, { nonNullable: true }),
  });

  private readonly hadExplicitPredecessors = (this.data.operation?.predecessors ?? []).length > 0;
  private readonly stepNumberValue = toSignal(
    this.formGroup.controls.stepNumber.valueChanges.pipe(startWith(this.formGroup.controls.stepNumber.value)),
    { initialValue: this.formGroup.controls.stepNumber.value });
  private readonly predecessorValue = toSignal(
    this.formGroup.controls.predecessorIds.valueChanges.pipe(startWith(this.formGroup.controls.predecessorIds.value)),
    { initialValue: this.formGroup.controls.predecessorIds.value });

  protected readonly predecessorOptions = computed<SelectOption[]>(() => {
    const step = Number(this.stepNumberValue() ?? 0);
    const currentId = this.data.operation?.id;
    return (this.data.operations ?? [])
      .filter(o => o.id !== currentId && o.stepNumber < step)
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map(o => ({ value: o.id, label: `Op ${o.stepNumber}: ${o.title}` }));
  });
  protected readonly completeGateOptions = computed<SelectOption[]>(() => {
    const selected = new Set(this.predecessorValue());
    return this.predecessorOptions().filter(o => selected.has(o.value as number));
  });

  private readonly keepDefaultPredecessors = this.formGroup.controls.stepNumber.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(step => {
      const control = this.formGroup.controls.predecessorIds;
      if (control.dirty) return;
      control.setValue(defaultPredecessorIds(this.data.operations ?? [], Number(step ?? 0), this.data.operation?.id));
    });

  private readonly attendance = toSignal(
    this.formGroup.controls.laborAttendancePercent.valueChanges.pipe(startWith(this.formGroup.controls.laborAttendancePercent.value)),
    { initialValue: this.formGroup.controls.laborAttendancePercent.value });
  protected readonly attendanceBelowFull = computed(() => {
    const value = this.attendance();
    return value !== null && value !== undefined && Number(value) < 100;
  });

  protected readonly violations = FormValidationService.getViolations(this.formGroup, {
    stepNumber: this.translate.instant('parts.stepNumber'),
    title: this.translate.instant('common.title'),
    estHours: this.translate.instant('parts.estHours'),
    estMinutes: this.translate.instant('parts.estMinutes'),
    estSeconds: this.translate.instant('parts.estSeconds'),
    setupMinutes: this.translate.instant('parts.setupTime'),
    runMinutesLot: this.translate.instant('parts.lotTime'),
    scrapFactorPercent: this.translate.instant('parts.scrapFactor'),
    laborAttendancePercent: this.translate.instant('parts.laborAttendance'),
    subcontractVendorId: this.translate.instant('parts.subcontractVendor'),
    subcontractTurnTimeDays: this.translate.instant('parts.subcontractTurnTimeDays'),
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

  // BOM lines available for material assignment
  protected readonly bomLineOptions = computed<SelectOption[]>(() => {
    const entries = this.data.bomLines ?? [];
    const assignedIds = new Set(this.materials().map(m => m.bomLineId));
    return entries
      .filter(e => !assignedIds.has(e.id))
      .map(e => ({ value: e.id, label: `${e.childPartNumber} — ${e.childName}` }));
  });

  // Add material form controls
  protected readonly newMaterialBomLineId = new FormControl<number | null>(null);
  protected readonly newMaterialQuantity = new FormControl<number>(1);

  // Comment control
  protected readonly commentControl = new FormControl('');

  ngOnInit(): void {
    this.loadWorkCenters();
    if (this.isEditMode) {
      this.loadFiles();
      this.loadActivity();
    }
  }

  private loadWorkCenters(): void {
    this.schedulingService.getWorkCenters().subscribe({
      next: (centers) => this.setWorkCenterOptions(centers),
    });
  }

  /**
   * Builds the select options from the loaded work centers, keeping the
   * leading "None" option. If the operation being edited references a work
   * center that isn't in the returned set (e.g. inactive), a synthetic option
   * is added from the operation's stored name so the current value still
   * renders instead of showing blank.
   */
  private setWorkCenterOptions(centers: WorkCenter[]): void {
    const options: SelectOption[] = [
      { value: null, label: this.translate.instant('parts.workCenterNone') },
      ...centers.map(c => ({ value: c.id, label: c.code ? `${c.code} — ${c.name}` : c.name })),
    ];

    const currentId = this.data.operation?.workCenterId ?? this.formGroup.controls.workCenterId.value;
    if (currentId != null && !centers.some(c => c.id === currentId)) {
      options.push({
        value: currentId,
        label: this.data.operation?.workCenterName ?? `#${currentId}`,
      });
    }

    this.workCenterOptions.set(options);
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

  private initialPredecessorIds(): number[] {
    const explicit = (this.data.operation?.predecessors ?? []).map(p => p.operationId);
    if (explicit.length > 0) return explicit;
    const step = this.data.operation?.stepNumber ?? this.data.nextStepNumber ?? 1;
    return defaultPredecessorIds(this.data.operations ?? [], step, this.data.operation?.id);
  }

  private predecessorPayload(stepNumber: number): OperationPredecessorRequest[] | undefined {
    const allowed = new Set(this.predecessorOptions().map(o => o.value as number));
    const selected = this.formGroup.controls.predecessorIds.value.filter(id => allowed.has(id));
    const complete = new Set(this.formGroup.controls.completeGateIds.value);
    const defaults = defaultPredecessorIds(this.data.operations ?? [], stepNumber, this.data.operation?.id);
    const isDefault = selected.length === 0 || (selected.every(id => !complete.has(id))
      && selected.length === defaults.length && defaults.every(id => selected.includes(id)));
    if (isDefault) return this.hadExplicitPredecessors ? [] : undefined;
    return selected.map((id): OperationPredecessorRequest => ({ operationId: id, gate: complete.has(id) ? 'Complete' : 'Quantity' }));
  }

  private submitUpdate(request: UpdateOperationRequest): void {
    this.partsService.updateOperation(this.data.partId, this.data.operation!.id, request, true).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.matDialogRef.close(result);
      },
      error: (err: unknown) => {
        const conflicts = predecessorConflictsOf(err);
        if (!conflicts) {
          this.saving.set(false);
          this.snackbar.errorFrom(err, 'parts.operationSaveFailed');
          return;
        }
        this.matDialog.open(ConfirmDialogComponent, {
          width: '440px',
          data: {
            title: this.translate.instant('parts.predecessorConflictTitle'),
            message: this.translate.instant('parts.predecessorConflictMessage', { links: describeConflicts(conflicts) }),
            confirmLabel: this.translate.instant('parts.predecessorConflictConfirm'),
            severity: 'warn',
          } satisfies ConfirmDialogData,
        }).afterClosed().subscribe(confirmed => {
          if (confirmed) {
            this.submitUpdate({ ...request, removeConflictingPredecessors: true });
            return;
          }
          this.saving.set(false);
        });
      },
    });
  }

  protected save(): void {
    if (this.formGroup.invalid) return;
    this.saving.set(true);

    const raw = this.formGroup.getRawValue();

    // Compose the canonical estimate in milliseconds from the three fields; a zero /
    // all-blank composition sends no estimate.
    const composedMs = ((raw.estHours ?? 0) * 3_600_000) + ((raw.estMinutes ?? 0) * 60_000) + Math.round((raw.estSeconds ?? 0) * 1000);
    const estimatedMs = composedMs > 0 ? composedMs : undefined;
    const scrapFactor = (raw.scrapFactorPercent ?? 0) / 100;

    // Phase 3 H5 / WU-13 — only send subcontract metadata when the toggle is
    // on; when off, send the flag as false + clear vendor/turn-time so the
    // server-side patch handler resets historical values.
    const isSubcontract = !!raw.isSubcontract;
    const subVendorId = isSubcontract ? (raw.subcontractVendorId ?? undefined) : null;
    const subTurnTime = isSubcontract ? (raw.subcontractTurnTimeDays ?? undefined) : null;

    const predecessors = this.predecessorPayload(raw.stepNumber ?? 1);
    if (this.data.operation) {
      this.submitUpdate({
        stepNumber: raw.stepNumber ?? undefined,
        title: raw.title ?? undefined,
        instructions: raw.instructions || undefined,
        workCenterId: raw.workCenterId ?? undefined,
        estimatedMs,
        setupMinutes: raw.setupMinutes ?? 0,
        runMinutesLot: raw.runMinutesLot ?? 0,
        scrapFactor,
        laborAttendancePercent: raw.laborAttendancePercent ?? 100,
        isQcCheckpoint: raw.isQcCheckpoint ?? undefined,
        qcCriteria: raw.qcCriteria || undefined,
        referencedOperationId: raw.referencedOperationId ?? 0,
        isSubcontract,
        subcontractVendorId: subVendorId as number | null | undefined,
        subcontractTurnTimeDays: subTurnTime as number | null | undefined,
        cycleCountdown: raw.cycleCountdown,
        ...(predecessors !== undefined ? { predecessors } : {}),
      });
    } else {
      this.partsService.createOperation(this.data.partId, {
        stepNumber: raw.stepNumber!,
        title: raw.title!,
        instructions: raw.instructions || undefined,
        workCenterId: raw.workCenterId ?? undefined,
        estimatedMs,
        setupMinutes: raw.setupMinutes ?? undefined,
        runMinutesLot: raw.runMinutesLot ?? undefined,
        scrapFactor,
        laborAttendancePercent: raw.laborAttendancePercent ?? 100,
        isQcCheckpoint: raw.isQcCheckpoint ?? false,
        qcCriteria: raw.qcCriteria || undefined,
        referencedOperationId: raw.referencedOperationId ?? undefined,
        isSubcontract,
        subcontractVendorId: isSubcontract ? (raw.subcontractVendorId ?? undefined) : undefined,
        subcontractTurnTimeDays: isSubcontract ? (raw.subcontractTurnTimeDays ?? undefined) : undefined,
        cycleCountdown: raw.cycleCountdown,
        ...(predecessors !== undefined ? { predecessors } : {}),
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
    const bomLineId = this.newMaterialBomLineId.value;
    const quantity = this.newMaterialQuantity.value ?? 1;
    if (!bomLineId) return;

    this.addingMaterial.set(true);
    this.partsService.createOperationMaterial(this.data.partId, this.data.operation!.id, {
      bomLineId,
      quantity,
    }).subscribe({
      next: (mat) => {
        this.materials.update(list => [...list, mat]);
        this.newMaterialBomLineId.reset();
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

  /**
   * Inline-create handler for the subcontract-vendor picker. When the
   * routing engineer realizes mid-flow that the chosen subcontract op
   * needs a vendor we haven't cataloged yet, opens the
   * VendorQuickCreateDialog pre-filled with the typed term so they
   * can keep going without bailing to the vendors page.
   */
  protected onCreateNewSubcontractVendor(typedTerm: string): void {
    this.matDialog.open<VendorQuickCreateDialogComponent, VendorQuickCreateDialogData, VendorListItem | null>(
      VendorQuickCreateDialogComponent,
      { width: '480px', data: { initialCompanyName: typedTerm } },
    ).afterClosed().subscribe((created) => {
      if (!created) return;
      this.formGroup.controls.subcontractVendorId.setValue(created.id);
      this.subcontractVendorPicker?.setSelected(created.id, created.companyName);
    });
  }

  /**
   * "+ New work center" — opens the quick-create dialog so a routing engineer
   * can add a missing work center inline without leaving the operation form.
   * On create, the new center is appended to the select options and selected.
   */
  protected onCreateWorkCenter(): void {
    this.matDialog.open<WorkCenterQuickCreateDialogComponent, WorkCenterQuickCreateDialogData, WorkCenter | null>(
      WorkCenterQuickCreateDialogComponent,
      { width: '420px', data: {} },
    ).afterClosed().subscribe((created) => {
      if (!created) return;
      this.workCenterOptions.update(opts => [
        ...opts,
        { value: created.id, label: created.code ? `${created.code} — ${created.name}` : created.name },
      ]);
      this.formGroup.controls.workCenterId.setValue(created.id);
    });
  }

  /**
   * Splits a canonical millisecond estimate into Hours / Minutes / Seconds for the
   * composable editor. The `seconds` field carries the sub-minute remainder (0–59.999).
   */
  private static decomposeMs(ms: number | null): { hours: number | null; minutes: number | null; seconds: number | null } {
    if (ms == null) return { hours: null, minutes: null, seconds: null };
    return {
      hours: Math.floor(ms / 3_600_000),
      minutes: Math.floor((ms % 3_600_000) / 60_000),
      seconds: (ms % 60_000) / 1000,
    };
  }
}
