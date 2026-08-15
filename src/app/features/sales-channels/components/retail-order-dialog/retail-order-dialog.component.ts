import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SalesChannelService } from '../../services/sales-channel.service';
import { RetailOrderService } from '../../services/retail-order.service';
import { RetailOrderCreated } from '../../models/sales-order-list-item.model';

export type RetailOrderDialogResult = RetailOrderCreated | undefined;

/**
 * Manual retail order entry — walk-ins, phone orders, trade shows.
 *
 * <p>Deliberately not the standard sales-order form. A retail order has no
 * quote to convert, no credit terms to pick and no customer PO to echo, because
 * the money is collected at the point of sale. What it does need — and what a
 * B2B order never asks for — is a consumer's name and a destination that is not
 * in anybody's address book.</p>
 *
 * <p>Prices are typed, not resolved from a price list: retail price is whatever
 * was actually charged, and inventing a number from a pricing rule would produce
 * an order that matches no receipt.</p>
 */
@Component({
  selector: 'app-retail-order-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    TranslatePipe,
    DialogComponent,
    InputComponent,
    SelectComponent,
    CurrencyInputComponent,
    ToggleComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './retail-order-dialog.component.html',
  styleUrl: './retail-order-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetailOrderDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<RetailOrderDialogComponent, RetailOrderDialogResult>);
  private readonly channelService = inject(SalesChannelService);
  private readonly orderService = inject(RetailOrderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly channelOptions = signal<SelectOption[]>([]);
  protected readonly noRetailChannels = signal(false);

  protected readonly form = this.fb.group({
    channelId: [null as number | null, Validators.required],
    buyerName: ['', [Validators.required, Validators.maxLength(200)]],
    buyerEmail: ['', [Validators.email, Validators.maxLength(200)]],
    buyerPhone: ['', Validators.maxLength(50)],
    marketingConsent: [false],

    shipToName: ['', [Validators.required, Validators.maxLength(200)]],
    shipToLine1: ['', [Validators.required, Validators.maxLength(200)]],
    shipToLine2: ['', Validators.maxLength(200)],
    shipToCity: ['', [Validators.required, Validators.maxLength(100)]],
    shipToState: ['', [Validators.required, Validators.maxLength(100)]],
    shipToPostalCode: ['', [Validators.required, Validators.maxLength(20)]],
    shipToCountry: ['US', [Validators.required, Validators.maxLength(10)]],

    taxRatePercent: [0, [Validators.min(0), Validators.max(99.9999)]],
    shippingAmount: [null as number | null, Validators.min(0)],
    notes: ['', Validators.maxLength(2000)],

    lines: this.fb.array([this.newLine()]),
  });

  protected get lines(): FormArray {
    return this.form.controls.lines;
  }

  protected readonly violations = FormValidationService.getViolations(this.form, {
    channelId: this.translate.instant('retailOrder.fieldChannel'),
    buyerName: this.translate.instant('retailOrder.fieldBuyerName'),
    shipToName: this.translate.instant('retailOrder.fieldShipToName'),
    shipToLine1: this.translate.instant('retailOrder.fieldAddress'),
    shipToCity: this.translate.instant('retailOrder.fieldCity'),
    shipToState: this.translate.instant('retailOrder.fieldState'),
    shipToPostalCode: this.translate.instant('retailOrder.fieldPostal'),
    lines: this.translate.instant('retailOrder.fieldLines'),
  });

  /** Running total, so the operator can check it against what the buyer actually paid. */
  protected readonly total = signal(0);

  protected readonly title = this.translate.instant('retailOrder.title');

  constructor() {
    this.channelService.getChannels().subscribe({
      next: (channels) => {
        const retail = channels.filter((c) => c.isRetail && c.isActive);
        this.noRetailChannels.set(retail.length === 0);
        this.channelOptions.set(retail.map((c) => ({ value: c.id, label: c.name })));

        // One retail channel is the common case for a shop that just started
        // selling direct — preselect it rather than making them pick from a
        // list of one.
        if (retail.length === 1) {
          this.form.controls.channelId.setValue(retail[0].id);
        }
      },
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recomputeTotal());
  }

  private newLine(): FormGroup {
    return this.fb.group({
      description: ['', [Validators.required, Validators.maxLength(500)]],
      externalSku: ['', Validators.maxLength(200)],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
    });
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    // Never leave the form with zero lines — the server rejects an empty order
    // and an empty grid gives the operator nothing to type into.
    if (this.lines.length <= 1) return;
    this.lines.removeAt(index);
  }

  protected readonly canRemoveLine = computed(() => this.lines.length > 1);

  private recomputeTotal(): void {
    const raw = this.form.getRawValue();
    const lineSum = (raw.lines as Array<{ quantity: number; unitPrice: number }>).reduce(
      (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      0,
    );
    const shipping = Number(raw.shippingAmount) || 0;
    const taxRate = (Number(raw.taxRatePercent) || 0) / 100;
    this.total.set((lineSum + shipping) * (1 + taxRate));
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const trimmed = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

    this.orderService
      .createOrder({
        channelId: raw.channelId,
        // Blank external id — the server mints a synthetic one so each walk-in
        // stays a distinct buyer rather than all of them collapsing together.
        buyer: {
          externalBuyerId: null,
          displayName: raw.buyerName!.trim(),
          contactEmail: trimmed(raw.buyerEmail),
          phone: trimmed(raw.buyerPhone),
          marketingConsent: !!raw.marketingConsent,
        },
        shipTo: {
          name: raw.shipToName!.trim(),
          company: null,
          line1: raw.shipToLine1!.trim(),
          line2: trimmed(raw.shipToLine2),
          city: raw.shipToCity!.trim(),
          state: raw.shipToState!.trim(),
          postalCode: raw.shipToPostalCode!.trim(),
          country: raw.shipToCountry!.trim(),
          phone: trimmed(raw.buyerPhone),
          // Hand-keyed addresses have not been through any validator; marking
          // them validated would let a typo skip the check an importer's
          // already-validated address legitimately skips.
          isValidated: false,
        },
        lines: (raw.lines as Array<{
          description: string; externalSku: string; quantity: number; unitPrice: number;
        }>).map((l) => ({
          partId: null,
          externalSku: trimmed(l.externalSku),
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          notes: null,
        })),
        externalOrderNumber: null,
        externalOrderId: null,
        taxRate: (Number(raw.taxRatePercent) || 0) / 100,
        taxCollectedBy: null,
        orderDate: null,
        notes: trimmed(raw.notes),
        shippingAmount: raw.shippingAmount ?? null,
      })
      .subscribe({
        next: (order) => {
          this.snackbar.success(
            this.translate.instant('retailOrder.created', { number: order.orderNumber }),
          );
          this.dialogRef.close(order);
        },
        error: () => this.saving.set(false),
      });
  }
}
