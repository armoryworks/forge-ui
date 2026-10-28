import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, ViewChild, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { VendorService } from '../../services/vendor.service';
import { VendorDetail } from '../../models/vendor-detail.model';
import { UpdateVendorRequest } from '../../models/update-vendor-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { Address } from '../../../../shared/models/address.model';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { PaymentTermsService } from '../../../../shared/services/payment-terms.service';
import { toAddress, fromAddressToVendor } from '../../../../shared/utils/address.utils';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { requiredTrimmed } from '../../../../shared/validators/required-trimmed.validator';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { AutoPoMode } from '../../../purchase-orders/models/auto-po-settings.model';

const USE_DEFAULT_AUTO_PO_MODE = 'default';

@Component({
  selector: 'app-vendor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    AddressFormComponent, ValidationButtonComponent, TranslatePipe, DocumentCurrencyComponent,
  ],
  templateUrl: './vendor-dialog.component.html',
  styleUrl: './vendor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly documentCurrency = viewChild(DocumentCurrencyComponent);
  private readonly vendorService = inject(VendorService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly paymentTerms = inject(PaymentTermsService).ensureLoaded();
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly capabilities = inject(CapabilityService);

  readonly vendor = input<VendorDetail | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly allowManualVendorNumbers = computed(() => this.manualNumberSettings.isEnabled('vendors'));
  protected readonly showAutoPoMode = computed(() => this.vendor() !== null && this.capabilities.isEnabled('CAP-P2P-AUTOPO'));
  protected readonly autoPoModeOptions: SelectOption[] = [
    { value: USE_DEFAULT_AUTO_PO_MODE, label: this.translate.instant('vendors.autoPoModeDefault') },
    { value: 'Suggest', label: this.translate.instant('autoPo.modeSuggest') },
    { value: 'Draft', label: this.translate.instant('autoPo.modeDraft') },
    { value: 'Automatic', label: this.translate.instant('autoPo.modeAutomatic') },
  ];

  protected get draftConfig(): DraftConfig {
    return {
      entityType: 'vendor',
      entityId: this.vendor()?.id?.toString() ?? 'new',
      route: '/vendors',
    };
  }

  readonly form = new FormGroup({
    companyName: new FormControl('', [requiredTrimmed]),
    vendorNumber: new FormControl('', [Validators.maxLength(50)]),
    contactName: new FormControl(''),
    email: new FormControl('', [Validators.email]),
    phone: new FormControl(''),
    fax: new FormControl('', [Validators.maxLength(50)]),
    address: new FormControl<Address | null>(null),
    paymentTermsId: new FormControl<number | null>(null),
    notes: new FormControl(''),
    isActive: new FormControl(true),
    is1099: new FormControl(false),
    taxId: new FormControl('', [Validators.maxLength(32)]),
    // Bought-parts effort PR4 — per-vendor variance threshold override.
    offTierVariancePct: new FormControl<number | null>(null, [Validators.min(0)]),
    overReceiptTolerancePct: new FormControl<number | null>(null, [Validators.min(0), Validators.max(999.99)]),
    underReceiptTolerancePct: new FormControl<number | null>(null, [Validators.min(0), Validators.max(100)]),
    currencyId: new FormControl<number | null>(null),
    autoPoMode: new FormControl<string>(USE_DEFAULT_AUTO_PO_MODE, { nonNullable: true }),
  });

  protected readonly vendorCurrencyId = computed(() => this.vendor()?.currencyId ?? null);
  protected readonly currencyLocked = computed(() => this.vendor()?.currencyLocked ?? false);

  protected readonly violations = FormValidationService.getViolations(this.form, {
    companyName: 'Company Name',
    contactName: 'Contact Name',
    email: 'Email',
    phone: 'Phone',
    fax: 'Fax',
    paymentTermsId: 'Payment Terms',
    notes: 'Notes',
    isActive: 'Active',
    is1099: '1099 Vendor',
    taxId: 'Tax ID',
    offTierVariancePct: this.translate.instant('vendors.offTierVariancePct'),
    overReceiptTolerancePct: this.translate.instant('tolerance.overPercent'),
    underReceiptTolerancePct: this.translate.instant('tolerance.underPercent'),
  });

  protected readonly paymentTermsOptions = this.paymentTerms.options;
  protected readonly unmatchedTermsText = computed(() => {
    const v = this.vendor();
    return v && v.paymentTermsId == null && v.paymentTerms ? v.paymentTerms : null;
  });

  ngOnInit(): void {
    const v = this.vendor();
    if (v) {
      this.form.patchValue({
        companyName: v.companyName,
        vendorNumber: v.vendorNumber ?? '',
        contactName: v.contactName ?? '',
        email: v.email ?? '',
        phone: v.phone ?? '',
        fax: v.fax ?? '',
        address: toAddress({ address: v.address, city: v.city, state: v.state, zipCode: v.zipCode, country: v.country }),
        paymentTermsId: v.paymentTermsId ?? null,
        notes: v.notes ?? '',
        isActive: v.isActive,
        is1099: v.is1099 ?? false,
        taxId: v.taxId ?? '',
        offTierVariancePct: v.offTierVariancePct ?? null,
        overReceiptTolerancePct: v.overReceiptTolerancePct ?? null,
        underReceiptTolerancePct: v.underReceiptTolerancePct ?? null,
        currencyId: v.currencyId ?? null,
        autoPoMode: v.autoPoMode ?? USE_DEFAULT_AUTO_PO_MODE,
      });
    }
  }

  private termsPayload(paymentTermsId: number | null): { paymentTermsId?: number; paymentTerms?: string } {
    if (paymentTermsId != null) return { paymentTermsId };
    return this.vendor() && this.form.controls.paymentTermsId.dirty ? { paymentTerms: '' } : {};
  }

  private autoPoModePayload(): { autoPoMode?: AutoPoMode; clearAutoPoMode?: boolean } {
    if (!this.showAutoPoMode() || !this.form.controls.autoPoMode.dirty) return {};
    const mode = this.form.controls.autoPoMode.value;
    return mode === USE_DEFAULT_AUTO_PO_MODE ? { clearAutoPoMode: true } : { autoPoMode: mode as AutoPoMode };
  }

  private tolerancePayload(): Pick<UpdateVendorRequest,
    'overReceiptTolerancePct' | 'underReceiptTolerancePct' | 'clearOverReceiptTolerance' | 'clearUnderReceiptTolerance'> {
    const over = this.form.controls.overReceiptTolerancePct;
    const under = this.form.controls.underReceiptTolerancePct;
    const editing = !!this.vendor();
    return {
      ...(over.value != null ? { overReceiptTolerancePct: over.value } : editing && over.dirty ? { clearOverReceiptTolerance: true } : {}),
      ...(under.value != null ? { underReceiptTolerancePct: under.value } : editing && under.dirty ? { clearUnderReceiptTolerance: true } : {}),
    };
  }

  protected get isEditing(): boolean {
    return this.vendor() !== null;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const addr = f.address;
    const v = this.vendor();
    const contactValue = (value: string | null | undefined): string | undefined =>
      value?.trim() || (v ? '' : undefined);

    const payload = {
      companyName: f.companyName?.trim() || undefined,
      contactName: f.contactName || undefined,
      email: contactValue(f.email),
      phone: contactValue(f.phone),
      fax: contactValue(f.fax),
      ...fromAddressToVendor(addr),
      ...this.termsPayload(f.paymentTermsId ?? null),
      notes: f.notes || undefined,
      is1099: f.is1099 ?? false,
      taxId: f.taxId?.trim() || undefined,
      offTierVariancePct: f.offTierVariancePct,
      ...this.tolerancePayload(),
      currencyId: this.documentCurrency()?.visible() && !this.currencyLocked() && (!v || this.form.controls.currencyId.dirty) ? (f.currencyId ?? undefined) : undefined,
    };

    if (v) {
      this.vendorService.updateVendor(v.id, {
        ...payload,
        vendorNumber: this.allowManualVendorNumbers() ? (f.vendorNumber?.trim() || undefined) : undefined,
        isActive: f.isActive ?? true,
        ...this.autoPoModePayload(),
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.snackbar.success(this.translate.instant('vendors.vendorUpdated'));
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.vendorService.createVendor({
        ...payload,
        companyName: f.companyName!.trim(),
        vendorNumber: this.allowManualVendorNumbers() ? (f.vendorNumber?.trim() || undefined) : undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.snackbar.success(this.translate.instant('vendors.vendorCreated'));
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
