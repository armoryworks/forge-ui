import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../shared/models/draft-config.model';
import { InventoryService } from '../../inventory/services/inventory.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { KanbanService } from '../services/kanban.service';
import { JobDetail } from '../models/job-detail.model';
import { JobDisposition } from '../models/job-disposition.type';
import { JobDispositionStock } from '../models/job-disposition-stock.model';

export interface DisposeJobDialogData {
  jobId: number;
  jobNumber: string;
  currentDisposition?: string | null;
}

const STOCKING_CAPABILITY = 'CAP-MFG-COMPLETE';

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
  private readonly capabilityService = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly addingToInventory = signal(false);
  protected readonly binOptions = signal<SelectOption[]>([]);
  protected readonly stock = signal<JobDispositionStock | null>(null);
  protected readonly stockProblemKey = signal<string | null>(null);
  private readonly stockingEnabled = this.capabilityService.isEnabled(STOCKING_CAPABILITY, true);
  private stockRequested = false;

  protected readonly draftConfig: DraftConfig = {
    entityType: 'job-disposition',
    entityId: this.data.jobId.toString(),
    route: '/board',
  };

  readonly formGroup = new FormGroup({
    disposition: new FormControl<JobDisposition | null>(null, [Validators.required, this.stockReadyForInventory()]),
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
    const stocking = disposition === 'AddToInventory' && this.addingToInventory();
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
    const { notes } = this.formGroup.controls;

    if (disposition && REASON_REQUIRED.includes(disposition)) {
      notes.addValidators(Validators.required);
    } else {
      notes.removeValidators(Validators.required);
    }
    notes.updateValueAndValidity();

    const stocking = disposition === 'AddToInventory' && this.stockingEnabled;
    if (stocking) {
      this.loadStock();
    }
    this.applyStockValidators(stocking);
  }

  private applyStockValidators(stocking: boolean): void {
    const { goodQuantity, locationId } = this.formGroup.controls;
    const stock = this.stock();
    const ready = stocking && stock != null && this.stockProblemKey() == null;
    this.addingToInventory.set(ready);

    locationId.clearValidators();
    if (ready) {
      const accounted = stock.receivedQuantity + stock.recordedQuantity;
      goodQuantity.setValidators([Validators.required, Validators.min(Math.max(accounted, 1)), Validators.pattern(/^\d+$/)]);
      if (goodQuantity.value == null && accounted > 0) {
        goodQuantity.setValue(accounted);
      }
    } else {
      goodQuantity.clearValidators();
    }
    goodQuantity.updateValueAndValidity();
    locationId.updateValueAndValidity();
  }

  private loadStock(): void {
    if (this.stockRequested) return;
    this.stockRequested = true;

    forkJoin({
      stock: this.kanbanService.getDispositionStock(this.data.jobId),
      bins: this.inventoryService.getBinLocations(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ stock, bins }) => {
        const activeBins = bins.filter(bin => bin.isActive);
        this.binOptions.set([
          { value: null, label: this.translate.instant('kanban.dispositionDefaultBin') },
          ...activeBins.map(bin => ({ value: bin.id, label: bin.locationPath || bin.name })),
        ]);
        this.stockProblemKey.set(this.problemKeyFor(stock));
        this.stock.set(stock);

        const locationId = this.formGroup.controls.locationId;
        if (locationId.value == null && stock.defaultBinId != null && activeBins.some(bin => bin.id === stock.defaultBinId)) {
          locationId.setValue(stock.defaultBinId);
        }

        this.formGroup.controls.disposition.updateValueAndValidity({ emitEvent: false });
        this.applyStockValidators(this.formGroup.controls.disposition.value === 'AddToInventory');
      },
      error: () => {
        this.stockRequested = false;
      },
    });
  }

  private problemKeyFor(stock: JobDispositionStock): string | null {
    if (stock.hasSeveralParts) return 'kanban.dispositionSeveralParts';
    if (stock.partId == null) return 'kanban.dispositionNoPart';
    if (stock.hasOpenRuns) return 'kanban.dispositionOpenRuns';
    return null;
  }

  private stockReadyForInventory(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value !== 'AddToInventory' || !this.stockingEnabled) return null;
      if (this.stock() == null) {
        return { stockPending: { message: this.translate.instant('common.loading') } };
      }
      const problemKey = this.stockProblemKey();
      return problemKey ? { stockProblem: { message: this.translate.instant(problemKey) } } : null;
    };
  }
}
