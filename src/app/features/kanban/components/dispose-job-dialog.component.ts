import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../shared/models/draft-config.model';
import { InventoryService } from '../../inventory/services/inventory.service';
import { PartsService } from '../../parts/services/parts.service';
import { KanbanService } from '../services/kanban.service';
import { JobDetail } from '../models/job-detail.model';
import { JobDisposition } from '../models/job-disposition.type';

export interface DisposeJobDialogData {
  jobId: number;
  jobNumber: string;
  partId?: number | null;
  currentDisposition?: string | null;
}

const REASON_REQUIRED: readonly JobDisposition[] = ['Scrap', 'HoldForReview', 'EnteredInError'];

const DISPOSITION_LABEL_KEYS: Record<JobDisposition, string> = {
  ShipToCustomer: 'kanban.dispositionShipToCustomer',
  AddToInventory: 'kanban.dispositionAddToInventory',
  CapitalizeAsAsset: 'kanban.dispositionCapitalizeAsAsset',
  Scrap: 'kanban.dispositionScrap',
  HoldForReview: 'kanban.dispositionHoldForReview',
  EnteredInError: 'kanban.dispositionEnteredInError',
  Other: 'kanban.dispositionOther',
};

@Component({
  selector: 'app-dispose-job-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DialogComponent, InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent, TranslatePipe],
  templateUrl: './dispose-job-dialog.component.html',
  styleUrl: './dispose-job-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisposeJobDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  readonly matDialogRef = inject(MatDialogRef<DisposeJobDialogComponent>);
  readonly data = inject<DisposeJobDialogData>(MAT_DIALOG_DATA);
  private readonly kanbanService = inject(KanbanService);
  private readonly inventoryService = inject(InventoryService);
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly addingToInventory = signal(false);
  protected readonly binOptions = signal<SelectOption[]>([]);
  private binsRequested = false;

  protected readonly draftConfig: DraftConfig = {
    entityType: 'job-disposition',
    entityId: this.data.jobId.toString(),
    route: '/board',
  };

  readonly formGroup = new FormGroup({
    disposition: new FormControl<JobDisposition | null>(null, [Validators.required, this.partRequiredForInventory()]),
    goodQuantity: new FormControl<number | null>(null),
    locationId: new FormControl<number | null>(null),
    notes: new FormControl('', [Validators.maxLength(2000)]),
  });

  readonly violations = FormValidationService.getViolations(this.formGroup, {
    disposition: this.translate.instant('jobs.disposition'),
    goodQuantity: this.translate.instant('kanban.dispositionGoodQuantity'),
    locationId: this.translate.instant('inventory.bin'),
    notes: this.translate.instant('common.notes'),
  });

  readonly dispositionOptions: SelectOption[] = (Object.keys(DISPOSITION_LABEL_KEYS) as JobDisposition[])
    .filter(value => !(value === 'HoldForReview' && this.data.currentDisposition === 'HoldForReview'))
    .map(value => ({ value, label: this.translate.instant(DISPOSITION_LABEL_KEYS[value]) }));

  constructor() {
    this.formGroup.controls.disposition.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(disposition => this.applyDisposition(disposition));
  }

  save(): void {
    if (this.formGroup.invalid || this.saving()) return;

    this.saving.set(true);
    const raw = this.formGroup.getRawValue();
    const disposition = raw.disposition!;
    const stocking = disposition === 'AddToInventory';
    this.kanbanService.disposeJob(this.data.jobId, {
      disposition,
      notes: raw.notes?.trim() || undefined,
      goodQuantity: stocking ? raw.goodQuantity ?? undefined : undefined,
      locationId: stocking ? raw.locationId ?? undefined : undefined,
    }).subscribe({
      next: (result: JobDetail) => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('kanban.jobDisposed', {
          disposition: this.translate.instant(DISPOSITION_LABEL_KEYS[disposition]),
        }));
        this.matDialogRef.close(result);
      },
      error: () => this.saving.set(false),
    });
  }

  private applyDisposition(disposition: JobDisposition | null): void {
    const { notes, goodQuantity, locationId } = this.formGroup.controls;

    if (disposition && REASON_REQUIRED.includes(disposition)) {
      notes.addValidators(Validators.required);
    } else {
      notes.removeValidators(Validators.required);
    }
    notes.updateValueAndValidity();

    const stocking = disposition === 'AddToInventory' && this.data.partId != null;
    this.addingToInventory.set(stocking);
    if (stocking) {
      goodQuantity.setValidators([Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]);
      locationId.setValidators([Validators.required]);
      this.loadBins();
    } else {
      goodQuantity.clearValidators();
      locationId.clearValidators();
    }
    goodQuantity.updateValueAndValidity();
    locationId.updateValueAndValidity();
  }

  private loadBins(): void {
    if (this.binsRequested || this.data.partId == null) return;
    this.binsRequested = true;

    forkJoin({
      bins: this.inventoryService.getBinLocations(),
      defaultBinId: this.partsService.getPartById(this.data.partId).pipe(
        map(part => part.defaultBinId),
        catchError(() => of(null)),
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ bins, defaultBinId }) => {
      this.binOptions.set(bins.map(bin => ({ value: bin.id, label: bin.locationPath || bin.name })));
      const locationId = this.formGroup.controls.locationId;
      if (locationId.value == null && defaultBinId != null && bins.some(bin => bin.id === defaultBinId)) {
        locationId.setValue(defaultBinId);
      }
    });
  }

  private partRequiredForInventory(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null =>
      control.value === 'AddToInventory' && this.data.partId == null
        ? { noPart: { message: this.translate.instant('kanban.dispositionNoPart') } }
        : null;
  }
}
