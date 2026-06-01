import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { InventoryService } from '../../../../inventory/services/inventory.service';
import { PurchaseUnitsService } from '../../../services/purchase-units.service';
import { PartPurchaseUnit } from '../../../models/part-purchase-unit.model';

/**
 * UoM purchase-units effort — authors a part's purchasable sizes/forms (4×8 sheet = 32 sqft,
 * 1 kg bar = 1000 g, bag of 100 = 100 ea). Self-contained CRUD (own data + API), shown on the
 * Sourcing tab alongside vendor sources; reusable verbatim in the guided part-creation workflow.
 * Content quantity is in the part's base/stock UoM — vendors then price each option.
 */
@Component({
  selector: 'app-part-purchase-units-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-purchase-units-cluster.component.html',
  styleUrls: ['../part-clusters.shared.scss', './part-purchase-units-cluster.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartPurchaseUnitsClusterComponent {
  private readonly service = inject(PurchaseUnitsService);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly partId = input.required<number>();
  readonly editing = input(false);

  protected readonly options = signal<PartPurchaseUnit[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uomOptions = signal<SelectOption[]>([{ value: null, label: '-- None --' }]);

  /** null = viewing; 'new' = adding; a number = editing that option's id. */
  protected readonly rowMode = signal<number | 'new' | null>(null);

  protected readonly form = new FormGroup({
    label: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    contentQuantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    contentUomId: new FormControl<number | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    label: 'Label',
    contentQuantity: 'Content Quantity',
  });

  constructor() {
    this.loadUoms();
    effect(() => {
      const id = this.partId();
      this.rowMode.set(null);
      this.load(id);
    });
  }

  private load(partId: number): void {
    this.loading.set(true);
    this.service.list(partId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.options.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadUoms(): void {
    this.inventoryService.getUnitsOfMeasure().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (uoms) => {
        const list = (uoms ?? []).filter(u => u.isActive);
        const options: SelectOption[] = [{ value: null, label: '-- None --' }];
        for (const u of list) {
          options.push({ value: u.id, label: u.symbol ? `${u.name} (${u.symbol})` : u.name });
        }
        this.uomOptions.set(options);
      },
    });
  }

  protected startAdd(): void {
    this.form.reset({ label: '', contentQuantity: null, contentUomId: null });
    this.rowMode.set('new');
  }

  protected startEdit(option: PartPurchaseUnit): void {
    this.form.reset({
      label: option.label,
      contentQuantity: option.contentQuantity,
      contentUomId: option.contentUomId,
    });
    this.rowMode.set(option.id);
  }

  protected cancelRow(): void {
    this.rowMode.set(null);
  }

  protected saveRow(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const mode = this.rowMode();
    if (mode === null) return;

    this.saving.set(true);
    const partId = this.partId();
    const done = (messageKey: string) => {
      this.saving.set(false);
      this.rowMode.set(null);
      this.load(partId);
      this.snackbar.success(this.translate.instant(messageKey));
    };
    const fail = () => this.saving.set(false);

    if (mode === 'new') {
      this.service.create(partId, {
        label: v.label.trim(),
        contentQuantity: v.contentQuantity ?? 0,
        contentUomId: v.contentUomId ?? null,
        sortOrder: this.options().length,
      }).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: () => done('parts.detail.purchaseUnits.added'), error: fail });
    } else {
      const existing = this.options().find(o => o.id === mode);
      this.service.update(partId, mode, {
        label: v.label.trim(),
        contentQuantity: v.contentQuantity ?? 0,
        contentUomId: v.contentUomId ?? null,
        sortOrder: existing?.sortOrder ?? 0,
        isActive: existing?.isActive ?? true,
      }).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: () => done('parts.detail.purchaseUnits.updated'), error: fail });
    }
  }

  protected remove(option: PartPurchaseUnit): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.detail.purchaseUnits.deleteTitle'),
        message: this.translate.instant('parts.detail.purchaseUnits.deleteMessage', { label: option.label }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(this.partId(), option.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.load(this.partId());
          this.snackbar.success(this.translate.instant('parts.detail.purchaseUnits.removed'));
        },
      });
    });
  }
}
