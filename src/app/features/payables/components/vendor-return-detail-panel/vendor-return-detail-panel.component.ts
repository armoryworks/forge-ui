import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorReturnService } from '../../services/vendor-return.service';
import { VendorReturnDetail } from '../../models/vendor-return-detail.model';
import { vendorCreditStatusChip } from '../../vendor-credit-status';
import { VENDOR_RETURN_ROLES } from '../../payables-roles';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DetailLoadErrorComponent } from '../../../../shared/components/detail-load-error/detail-load-error.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { toIsoDate, todayStart } from '../../../../shared/utils/date.utils';
import { downloadBlob } from '../../../../shared/utils/download-blob';

/**
 * A return to vendor: the held lot going back, shipping it out of quality hold and inventory, recording the vendor's
 * credit, and the packing document.
 */
@Component({
  selector: 'app-vendor-return-detail-panel',
  standalone: true,
  imports: [
    DecimalPipe, ReactiveFormsModule, MatTooltipModule, TranslatePipe, DateOnlyPipe,
    DialogComponent, InputComponent, DatepickerComponent, TextareaComponent, ValidationButtonComponent,
    EntityActivitySectionComponent, EntityLinkComponent, CurrencyDisplayComponent, DetailLoadErrorComponent, LoadingBlockDirective,
  ],
  templateUrl: './vendor-return-detail-panel.component.html',
  styleUrl: './vendor-return-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorReturnDetailPanelComponent {
  private readonly service = inject(VendorReturnService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly returnId = input.required<number>();
  readonly closed = output<void>();
  readonly updated = output<void>();

  protected readonly rtv = signal<VendorReturnDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly busy = signal(false);
  protected readonly downloadingPdf = signal(false);
  protected readonly showShip = signal(false);
  protected readonly showCredit = signal(false);

  private readonly canAct = inject(AuthService).hasAnyRole(VENDOR_RETURN_ROLES);
  protected readonly canShip = computed(() => this.canAct && this.rtv()?.status === 'Open');
  protected readonly canCredit = computed(() => this.canAct && this.rtv()?.status === 'Shipped');

  protected readonly shipForm = new FormGroup({
    shipDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    carrier: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    trackingNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    rmaNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  protected readonly shipViolations = FormValidationService.getViolations(this.shipForm, {
    shipDate: this.translate.instant('vendorReturns.shipDate'),
  });

  protected readonly creditForm = new FormGroup({
    vendorReference: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    memoDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    prices: new FormArray<FormControl<number | null>>([]),
  });
  protected readonly creditViolations = FormValidationService.getViolations(this.creditForm, {
    memoDate: this.translate.instant('vendorCredits.memoDate'),
  });

  constructor() {
    effect(() => {
      const id = this.returnId();
      if (id) this.load(id);
    });
  }

  protected load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getById(id).subscribe({
      next: rtv => {
        this.rtv.set(rtv);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(err);
      },
    });
  }

  protected statusClass(status: string): string {
    return vendorCreditStatusChip(status);
  }

  protected openShip(): void {
    const r = this.rtv();
    this.shipForm.reset({ shipDate: todayStart(), carrier: r?.carrier ?? '', trackingNumber: r?.trackingNumber ?? '', rmaNumber: r?.rmaNumber ?? '', notes: '' });
    this.showShip.set(true);
  }

  protected ship(): void {
    const r = this.rtv();
    if (!r || this.shipForm.invalid || this.busy()) return;
    const f = this.shipForm.getRawValue();
    this.busy.set(true);
    this.service.ship(r.id, {
      shipDate: toIsoDate(f.shipDate),
      carrier: f.carrier.trim() || null,
      trackingNumber: f.trackingNumber.trim() || null,
      rmaNumber: f.rmaNumber.trim() || null,
      notes: f.notes.trim() || null,
    }).subscribe({
      next: shipped => {
        this.rtv.set(shipped);
        this.busy.set(false);
        this.showShip.set(false);
        this.snackbar.success(this.translate.instant('vendorReturns.shipped', { number: shipped.returnNumber }));
        this.updated.emit();
      },
      error: () => this.busy.set(false),
    });
  }

  protected openCredit(): void {
    const r = this.rtv();
    if (!r) return;
    this.creditForm.controls.prices.clear();
    for (const line of r.lines)
      this.creditForm.controls.prices.push(new FormControl<number | null>(line.unitPrice, [Validators.required, Validators.min(0)]));
    this.creditForm.patchValue({ vendorReference: '', memoDate: todayStart() });
    this.showCredit.set(true);
  }

  protected recordCredit(): void {
    const r = this.rtv();
    if (!r || this.creditForm.invalid || this.busy()) return;
    const f = this.creditForm.getRawValue();
    this.busy.set(true);
    this.service.recordCredit(r.id, {
      vendorReference: f.vendorReference.trim() || null,
      memoDate: toIsoDate(f.memoDate),
      notes: null,
      lines: r.lines.map((line, i) => ({ vendorReturnLineId: line.id, quantity: null, unitPrice: f.prices[i] ?? line.unitPrice })),
    }).subscribe({
      next: memo => {
        this.busy.set(false);
        this.showCredit.set(false);
        this.snackbar.success(this.translate.instant('vendorReturns.credited', { number: memo.memoNumber }));
        this.updated.emit();
        this.load(r.id);
      },
      error: () => this.busy.set(false),
    });
  }

  protected downloadPdf(): void {
    const r = this.rtv();
    if (!r || this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.getPdf(r.id, this.translate.getCurrentLang?.() || 'en').subscribe({
      next: blob => {
        this.downloadingPdf.set(false);
        downloadBlob(blob, `${r.returnNumber}.pdf`);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }
}
