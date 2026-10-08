import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { DATE_FORMAT } from '../../../../shared/utils/date.utils';
import { PartDetail } from '../../models/part-detail.model';
import { PartRevision } from '../../models/part-revision.model';
import { PartStatus } from '../../models/part-status.type';
import { InventoryClass, INVENTORY_CLASSES } from '../../models/inventory-class.type';
import { ProcurementSource, PROCUREMENT_SOURCES } from '../../models/procurement-source.type';
import { PartsService } from '../../services/parts.service';
import { PartReviseDialogComponent, PartReviseDialogData } from '../part-revise-dialog/part-revise-dialog.component';

/**
 * Pillar 4 — Identity & classification cluster.
 *
 * Renders read-only or edit form for the part's identity fields:
 * Part Number (read-only), Name, Description, Revision, Status,
 * ProcurementSource, InventoryClass, ItemKindLabel, Manufacturer fields,
 * ExternalPartNumber, plus the part's revision history.
 *
 * Used as the default Identity tab on the Part detail page across
 * every (procurementSource, inventoryClass) combination.
 */
@Component({
  selector: 'app-part-identity-cluster',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-identity-cluster.component.html',
  styleUrl: './part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartIdentityClusterComponent {
  private readonly partsService = inject(PartsService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);
  /** `parts.allow_manual_numbers` — when true, Part Number is editable in edit mode. */
  readonly allowManualNumbers = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly saveAndClose = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();
  readonly revised = output<PartRevision>();

  protected readonly form = new FormGroup({
    partNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string | null>(null),
    revision: new FormControl('', { nonNullable: true }),
    status: new FormControl<PartStatus>('Draft', { nonNullable: true, validators: [Validators.required] }),
    procurementSource: new FormControl<ProcurementSource>('Buy', { nonNullable: true, validators: [Validators.required] }),
    inventoryClass: new FormControl<InventoryClass>('Component', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name', status: 'Status',
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Prototype', label: 'Prototype' },
    { value: 'Active', label: 'Active' },
    { value: 'Obsolete', label: 'Obsolete' },
  ];

  protected readonly procurementSourceOptions: SelectOption[] = PROCUREMENT_SOURCES.map((v) => ({
    value: v,
    label: this.translate.instant(`parts.procurementSource.${v}`),
  }));

  protected readonly inventoryClassOptions: SelectOption[] = INVENTORY_CLASSES.map((v) => ({
    value: v,
    label: this.translate.instant(`parts.inventoryClass.${v}`),
  }));

  protected readonly procurementLabel = computed(() => this.part().procurementSource);
  protected readonly inventoryClassLabel = computed(() => this.part().inventoryClass);

  protected readonly dateFormat = DATE_FORMAT;
  protected readonly revisions = signal<PartRevision[]>([]);
  protected readonly canRevise = computed(() => this.auth.hasAnyRole(['Admin', 'Manager', 'Engineer']));
  private readonly revisionKey = computed(() => `${this.part().id}:${this.part().revision}`);
  private readonly localRevision = signal<{ partId: number; from: string; to: string } | null>(null);
  private readonly currentRevision = computed(() => {
    const p = this.part();
    const local = this.localRevision();
    return local && local.partId === p.id && local.from === p.revision ? local.to : p.revision;
  });

  constructor() {
    effect(() => {
      const p = this.part();
      this.form.reset({
        partNumber: p.partNumber,
        name: p.name,
        description: p.description,
        revision: this.currentRevision(),
        status: p.status,
        procurementSource: p.procurementSource,
        inventoryClass: p.inventoryClass,
      });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });

    effect(() => {
      this.revisionKey();
      untracked(() => this.loadRevisions());
    });
  }

  protected onSave(close = false): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const p = this.part();
    const patch: Partial<PartDetail> = {
      name: v.name,
      description: v.description ?? null,
      status: v.status,
    };
    if (v.revision.trim() !== this.currentRevision().trim()) {
      patch.revision = v.revision.trim();
    }
    if (this.allowManualNumbers() && v.partNumber.trim() && v.partNumber.trim() !== p.partNumber) {
      patch.partNumber = v.partNumber.trim();
    }
    const sourceChanged = v.procurementSource !== p.procurementSource;
    const classChanged = v.inventoryClass !== p.inventoryClass;
    if (sourceChanged) patch.procurementSource = v.procurementSource;
    if (classChanged) patch.inventoryClass = v.inventoryClass;

    const emit = () => (close ? this.saveAndClose : this.save).emit(patch);
    if (!sourceChanged && !classChanged) {
      emit();
      return;
    }

    const from = this.classificationLabel(p.procurementSource, p.inventoryClass);
    const to = this.classificationLabel(v.procurementSource, v.inventoryClass);
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('partRevisions.classification.confirmTitle'),
        message: this.translate.instant('partRevisions.classification.confirmMessage', { from, to }),
        details: [
          this.translate.instant('partRevisions.classification.tabsChange'),
          this.translate.instant('partRevisions.classification.recordsUntouched'),
        ],
        confirmLabel: this.translate.instant('partRevisions.classification.confirm'),
        severity: 'warn',
      },
    }).afterClosed().subscribe((confirmed) => {
      if (confirmed) emit();
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected openRevise(): void {
    const p = this.part();
    this.dialog.open<PartReviseDialogComponent, PartReviseDialogData, PartRevision | null>(PartReviseDialogComponent, {
      width: '480px',
      data: { part: p, revisions: this.revisions() },
    }).afterClosed().subscribe((created) => {
      if (!created) return;
      this.localRevision.set({ partId: p.id, from: p.revision, to: created.revision });
      this.loadRevisions();
      this.revised.emit(created);
    });
  }

  private loadRevisions(): void {
    const id = this.part().id;
    this.partsService.getRevisions(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (revisions) => {
          if (this.part().id === id) this.revisions.set(revisions);
        },
        error: () => this.revisions.set([]),
      });
  }

  private classificationLabel(source: ProcurementSource, inventoryClass: InventoryClass): string {
    return `${this.translate.instant(`parts.procurementSource.${source}`)} / ${this.translate.instant(`parts.inventoryClass.${inventoryClass}`)}`;
  }
}
