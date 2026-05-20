import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { Address } from '../../../../shared/models/address.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { phoneValidator } from '../../../../shared/validators/phone.validator';
import { PAYMENT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';
import { fromAddressToVendor } from '../../../../shared/utils/address.utils';

import { CreateVendorRequest } from '../../models/create-vendor-request.model';
import { PartQuickCreateDialogComponent, PartQuickCreateDialogData } from '../../../parts/components/part-quick-create-dialog/part-quick-create-dialog.component';
import { PartDetail } from '../../../parts/models/part-detail.model';

/**
 * Guided vendor-creation wizard — the heavyweight counterpart to the inline
 * quick-add dialog, for strategic / approved-vendor-list partners worth the
 * upfront effort. Mirrors the customer guided wizard's shape (fork → stepper
 * → same create endpoint, no workflow engine).
 *
 * Steps:
 *   1. Identity      — company, contact, email, phone
 *   2. Relationship  — vendor type (transactional / strategic / subcontractor
 *                      / distributor) + type-specific extras, folded into notes
 *   3. Address       — remit-to / primary address
 *   4. Terms         — payment terms + off-tier variance override + notes
 *   5. Supply items  — parts/consumables this vendor supplies (VendorPart drafts)
 *   6. Review        — confirm + commit
 *
 * Output is a {@link GuidedVendorResult}: the {@link CreateVendorRequest} the
 * existing vendor endpoint already accepts, plus an in-memory list of supply
 * items the parent commits as VendorPart rows once the vendor id exists.
 */

const VENDOR_TYPE_CHOICES = ['Transactional', 'Strategic', 'Subcontractor', 'Distributor'] as const;
type VendorRelationshipType = typeof VENDOR_TYPE_CHOICES[number] | 'Unknown';

export interface GuidedVendorSupplyItem {
  partId: number;
  partLabel: string;
  vendorPartNumber: string | null;
  leadTimeDays: number | null;
  minOrderQty: number | null;
  isPreferred: boolean;
}

export interface GuidedVendorResult {
  request: CreateVendorRequest;
  supplyItems: GuidedVendorSupplyItem[];
}

const MAX_STEP = 5;

@Component({
  selector: 'app-guided-vendor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    MatStepperModule,
    DialogComponent,
    InputComponent, SelectComponent, ToggleComponent, TextareaComponent,
    AddressFormComponent, EntityPickerComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './guided-vendor-dialog.component.html',
  styleUrl: './guided-vendor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidedVendorDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GuidedVendorDialogComponent, GuidedVendorResult | undefined>);
  private readonly matDialog = inject(MatDialog);
  protected readonly translate = inject(TranslateService);

  protected readonly maxStep = MAX_STEP;
  protected readonly currentStep = signal(0);
  protected readonly vendorType = signal<VendorRelationshipType>('Unknown');
  protected readonly supplyItems = signal<GuidedVendorSupplyItem[]>([]);

  protected readonly form = new FormGroup({
    companyName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    contactName: new FormControl<string>('', { nonNullable: true }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email] }),
    phone: new FormControl<string>('', { nonNullable: true, validators: [phoneValidator] }),

    address: new FormControl<Address | null>(null),

    paymentTerms: new FormControl<string>('', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true }),

    // Relationship-type extras (folded into notes on commit).
    accountManager: new FormControl<string>('', { nonNullable: true }),
    capabilities: new FormControl<string>('', { nonNullable: true }),
    processes: new FormControl<string>('', { nonNullable: true }),
    certifications: new FormControl<string>('', { nonNullable: true }),
    linesCarried: new FormControl<string>('', { nonNullable: true }),
  });

  /** In-progress supply-item builder for the supply-items step. */
  protected readonly supplyForm = new FormGroup({
    partId: new FormControl<number | null>(null),
    vendorPartNumber: new FormControl<string>('', { nonNullable: true }),
    leadTimeDays: new FormControl<number | null>(null, [Validators.min(0)]),
    minOrderQty: new FormControl<number | null>(null, [Validators.min(0)]),
    isPreferred: new FormControl<boolean>(false, { nonNullable: true }),
  });

  private pendingPartLabel = '';

  protected readonly paymentTermsOptions = PAYMENT_TERMS_OPTIONS;

  protected readonly typeChoices = VENDOR_TYPE_CHOICES.map(value => ({
    value,
    titleKey: `vendors.guided.type.${value}`,
    descKey: `vendors.guided.type.${value}Desc`,
    icon: this.iconFor(value),
  }));

  protected readonly violations = FormValidationService.getViolations(this.form, {
    companyName: this.translate.instant('vendors.companyName'),
    email: this.translate.instant('common.email'),
  });

  protected readonly showsStrategicExtras = computed(() => this.vendorType() === 'Strategic');
  protected readonly showsSubcontractorExtras = computed(() => this.vendorType() === 'Subcontractor');
  protected readonly showsDistributorExtras = computed(() => this.vendorType() === 'Distributor');

  protected readonly typePlaybook = computed(() => {
    const t = this.vendorType();
    if (t === 'Unknown') return null;
    return this.translate.instant(`vendors.guided.type.${t}Playbook`);
  });

  protected pickType(t: VendorRelationshipType): void {
    this.vendorType.set(t);
    this.next();
  }

  protected next(): void { this.currentStep.update(s => Math.min(MAX_STEP, s + 1)); }
  protected back(): void { this.currentStep.update(s => Math.max(0, s - 1)); }
  protected close(): void { this.dialogRef.close(undefined); }

  /** Capture the picked part's display label so the list shows it, not just an id. */
  protected onPartSelected(entity: Record<string, unknown> | null): void {
    if (!entity) { this.pendingPartLabel = ''; return; }
    const pn = String(entity['partNumber'] ?? '');
    const name = String(entity['name'] ?? '');
    this.pendingPartLabel = [pn, name].filter(Boolean).join(' — ');
  }

  /** Inline-create a part (Buy default), then drop it into the supply builder. */
  protected onCreateNewPart(typedTerm: string): void {
    this.matDialog.open<PartQuickCreateDialogComponent, PartQuickCreateDialogData, PartDetail | null>(
      PartQuickCreateDialogComponent,
      { width: '480px', data: { initialName: typedTerm, defaultProcurementSource: 'Buy' } },
    ).afterClosed().subscribe((created) => {
      if (!created) return;
      this.supplyForm.controls.partId.setValue(created.id);
      this.pendingPartLabel = [created.partNumber, created.name].filter(Boolean).join(' — ');
    });
  }

  protected addSupplyItem(): void {
    const partId = this.supplyForm.controls.partId.value;
    if (!partId || this.supplyForm.invalid) return;
    const v = this.supplyForm.getRawValue();
    this.supplyItems.update(items => [...items, {
      partId,
      partLabel: this.pendingPartLabel || `#${partId}`,
      vendorPartNumber: v.vendorPartNumber.trim() || null,
      leadTimeDays: v.leadTimeDays,
      minOrderQty: v.minOrderQty,
      isPreferred: v.isPreferred,
    }]);
    this.pendingPartLabel = '';
    this.supplyForm.reset({
      partId: null, vendorPartNumber: '', leadTimeDays: null, minOrderQty: null, isPreferred: false,
    });
  }

  protected removeSupplyItem(index: number): void {
    this.supplyItems.update(items => items.filter((_, i) => i !== index));
  }

  protected confirm(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    // Fold relationship type + type-specific extras into the notes field —
    // the server schema doesn't model a vendor type column yet, so we
    // surface them as structured note text (same approach as the customer
    // guided wizard's engagement shape).
    const noteLines: string[] = [];
    if (v.notes.trim()) noteLines.push(v.notes.trim());
    if (this.vendorType() !== 'Unknown') {
      noteLines.push(`Relationship: ${this.vendorType()}`);
    }
    if (this.showsStrategicExtras()) {
      if (v.accountManager.trim()) noteLines.push(`Account manager: ${v.accountManager.trim()}`);
      if (v.capabilities.trim()) noteLines.push(`Capabilities: ${v.capabilities.trim()}`);
    }
    if (this.showsSubcontractorExtras()) {
      if (v.processes.trim()) noteLines.push(`Processes: ${v.processes.trim()}`);
      if (v.certifications.trim()) noteLines.push(`Certifications: ${v.certifications.trim()}`);
    }
    if (this.showsDistributorExtras() && v.linesCarried.trim()) {
      noteLines.push(`Lines carried: ${v.linesCarried.trim()}`);
    }

    const request: CreateVendorRequest = {
      companyName: v.companyName.trim(),
      contactName: v.contactName.trim() || undefined,
      email: v.email.trim() || undefined,
      phone: v.phone.trim() || undefined,
      paymentTerms: v.paymentTerms || undefined,
      notes: noteLines.length ? noteLines.join('\n') : undefined,
      ...fromAddressToVendor(v.address),
    };

    this.dialogRef.close({ request, supplyItems: this.supplyItems() });
  }

  protected iconFor(type: VendorRelationshipType): string {
    const map: Record<VendorRelationshipType, string> = {
      Unknown: 'flash_on',
      Transactional: 'receipt_long',
      Strategic: 'business_center',
      Subcontractor: 'precision_manufacturing',
      Distributor: 'local_shipping',
    };
    return map[type];
  }
}
