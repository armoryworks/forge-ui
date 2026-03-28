import { ChangeDetectionStrategy, Component, computed, inject, output, signal, Signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { PartsService } from '../../../parts/services/parts.service';
import { VendorResponse } from '../../../vendors/models/vendor-response.model';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { CreatePurchaseOrderLineRequest } from '../../models/create-purchase-order-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface LineEntry {
  partId: number;
  partNumber: string;
  description: string;
  orderedQuantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-po-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    AutocompleteComponent, ValidationPopoverDirective, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './po-dialog.component.html',
  styleUrl: './po-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoDialogComponent {
  private readonly poService = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly vendors = signal<VendorResponse[]>([]);
  protected readonly parts = signal<PartListItem[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);
  /** True while the unit price reflects the part's list price and hasn't been manually edited. */
  protected readonly priceIsDefault = signal(false);

  protected readonly vendorOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('purchaseOrders.selectVendor') },
    ...this.vendors().map(v => ({ value: v.id, label: v.companyName })),
  ]);

  protected readonly partOptions = computed<AutocompleteOption[]>(() =>
    this.parts().map(p => ({ value: p.id, label: `${p.partNumber} — ${p.description}` })));

  protected readonly form = new FormGroup({
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    jobId: new FormControl<number | null>(null),
    notes: new FormControl(''),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    vendorId: 'Vendor',
    jobId: 'Job',
    notes: 'Notes',
  });

  protected readonly violations: Signal<string[]> = computed(() => [
    ...this.formViolations(),
    ...(this.lines().length === 0 ? ['At least one line item is required'] : []),
  ]);

  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    orderedQuantity: new FormControl<number>(1, [Validators.required, Validators.min(1)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly lineTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.orderedQuantity * l.unitPrice, 0)
  );

  constructor() {
    this.vendorService.getVendorDropdown().subscribe({
      next: (list) => this.vendors.set(list),
    });
    this.partsService.getParts().subscribe({
      next: (list) => this.parts.set(list),
    });

    // Pre-fill unit price from part's list price when a part is selected
    this.lineForm.controls.partId.valueChanges.subscribe((partId) => {
      this.onPartSelected(partId);
    });

    // When price is manually changed, clear the "list price" indicator
    this.lineForm.controls.unitPrice.valueChanges.subscribe(() => {
      this.priceIsDefault.set(false);
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  private onPartSelected(partId: number | null): void {
    if (partId == null) {
      this.priceIsDefault.set(false);
      return;
    }
    const part = this.parts().find(p => p.id === partId);
    if (part?.defaultPrice != null) {
      this.lineForm.controls.unitPrice.setValue(part.defaultPrice, { emitEvent: false });
      this.priceIsDefault.set(true);
    } else {
      this.priceIsDefault.set(false);
    }
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const part = this.parts().find(p => p.id === f.partId);
    if (!part) return;
    this.lines.update(prev => [...prev, {
      partId: part.id,
      partNumber: part.partNumber,
      description: part.description,
      orderedQuantity: f.orderedQuantity!,
      unitPrice: f.unitPrice!,
    }]);
    this.lineForm.reset({ partId: null, orderedQuantity: 1, unitPrice: 0 });
    this.priceIsDefault.set(false);
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const lineRequests: CreatePurchaseOrderLineRequest[] = this.lines().map(l => ({
      partId: l.partId,
      quantity: l.orderedQuantity,
      unitPrice: l.unitPrice,
    }));

    this.poService.createPurchaseOrder({
      vendorId: f.vendorId!,
      jobId: f.jobId ?? undefined,
      notes: f.notes || undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('purchaseOrders.poCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
