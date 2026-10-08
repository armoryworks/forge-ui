import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, map, of, switchMap, tap } from 'rxjs';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';

import { VendorPart } from '../../../parts/models/vendor-part.model';
import { VendorPartsService } from '../../../parts/services/vendor-parts.service';
import { VendorDetail } from '../../models/vendor-detail.model';

/**
 * Vendor workflow supply-items step. Optional. Adds the parts this vendor
 * supplies through the standard VendorPart create call, with an optional
 * quantity-1 price tier. A part picked but not yet added is added on
 * Continue, so the user does not lose a half-entered row.
 */
@Component({
  selector: 'app-vendor-supply-items-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, CurrencyPipe,
    EntityPickerComponent, InputComponent, CurrencyInputComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './vendor-supply-items-step.component.html',
  styleUrl: './vendor-supply-items-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorSupplyItemsStepComponent {
  private readonly vendorPartsService = inject(VendorPartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('supplyItems');
  readonly componentName = input<string>('VendorSupplyItemsStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly vendorId = computed<number | null>(
    () => this.entityId() ?? (this.entity() as VendorDetail | null)?.id ?? null,
  );

  protected readonly items = signal<VendorPart[]>([]);
  protected readonly adding = signal(false);

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(null),
    vendorPartNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    unitPrice: new FormControl<number | null>(null, [Validators.min(0)]),
    leadTimeDays: new FormControl<number | null>(null, [Validators.min(0)]),
  });

  constructor() {
    effect(() => {
      const vendorId = this.vendorId();
      if (vendorId == null) return;
      untracked(() => this.loadItems(vendorId));
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        partId: this.translate.instant('guidedSetup.supplyItems.partLabel'),
        vendorPartNumber: this.translate.instant('guidedSetup.supplyItems.vendorPartNumberLabel'),
        unitPrice: this.translate.instant('guidedSetup.supplyItems.unitPriceLabel'),
        leadTimeDays: this.translate.instant('guidedSetup.supplyItems.leadTimeDaysLabel'),
      },
      () => this.save(),
    );
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  protected canAdd(): boolean {
    return this.vendorId() != null && this.form.controls.partId.value != null && this.form.valid && !this.adding();
  }

  protected addItem(): void {
    this.addPending().subscribe({ error: () => undefined });
  }

  private save(): Observable<unknown> {
    if (this.form.controls.partId.value == null) return of(null);
    return this.addPending();
  }

  private addPending(): Observable<VendorPart | null> {
    const vendorId = this.vendorId();
    const value = this.form.getRawValue();
    if (vendorId == null || value.partId == null || this.form.invalid) return of(null);
    this.adding.set(true);
    return this.vendorPartsService.create({
      vendorId,
      partId: value.partId,
      vendorPartNumber: value.vendorPartNumber.trim() || null,
      leadTimeDays: value.leadTimeDays ?? null,
      isApproved: true,
      isPreferred: false,
    }).pipe(
      switchMap((created) => value.unitPrice == null
        ? of(created)
        : this.vendorPartsService.addPriceTier(created.id, { minQuantity: 1, unitPrice: value.unitPrice }).pipe(map(() => created))),
      tap({
        next: () => {
          this.adding.set(false);
          this.form.reset({ partId: null, vendorPartNumber: '', unitPrice: null, leadTimeDays: null });
          this.snackbar.success(this.translate.instant('guidedSetup.supplyItems.added'));
          this.loadItems(vendorId);
        },
        error: () => this.adding.set(false),
      }),
    );
  }

  private loadItems(vendorId: number): void {
    this.vendorPartsService.listForVendor(vendorId).subscribe({
      next: (rows) => this.items.set(rows),
      error: () => this.items.set([]),
    });
  }

  protected unitPrice(item: VendorPart): number | null {
    return item.priceTiers.find((t) => t.minQuantity <= 1)?.unitPrice ?? item.priceTiers[0]?.unitPrice ?? null;
  }
}
