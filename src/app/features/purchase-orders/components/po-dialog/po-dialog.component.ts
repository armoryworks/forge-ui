import { ChangeDetectionStrategy, Component, inject, signal, output, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { VendorResponse } from '../../../vendors/models/vendor-response.model';
import { CreatePurchaseOrderLineRequest } from '../../models/create-purchase-order-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
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
    ValidationPopoverDirective,
  ],
  templateUrl: './po-dialog.component.html',
  styleUrl: './po-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoDialogComponent {
  private readonly poService = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly snackbar = inject(SnackbarService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly vendors = signal<VendorResponse[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);

  protected readonly vendorOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Select vendor...' },
    ...this.vendors().map(v => ({ value: v.id, label: v.companyName })),
  ]);

  protected readonly form = new FormGroup({
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    jobId: new FormControl<number | null>(null),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    vendorId: 'Vendor',
    jobId: 'Job',
    notes: 'Notes',
  });

  // Line item form
  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    partNumber: new FormControl('', [Validators.required]),
    description: new FormControl(''),
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
  }

  protected close(): void {
    this.closed.emit();
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    this.lines.update(prev => [...prev, {
      partId: f.partId!,
      partNumber: f.partNumber!,
      description: f.description ?? '',
      orderedQuantity: f.orderedQuantity!,
      unitPrice: f.unitPrice!,
    }]);
    this.lineForm.reset({ partId: null, partNumber: '', description: '', orderedQuantity: 1, unitPrice: 0 });
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
      orderedQuantity: l.orderedQuantity,
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
        this.snackbar.success('Purchase order created.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
