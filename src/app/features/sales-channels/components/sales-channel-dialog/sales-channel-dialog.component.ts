import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { ECommerceConnectionService } from '../../services/ecommerce-connection.service';
import { SalesChannelService } from '../../services/sales-channel.service';
import { SalesChannel, SalesChannelType, TaxCollectedBy } from '../../models/sales-channel.model';

export interface SalesChannelDialogData {
  /** Null creates; a channel edits it. */
  channel: SalesChannel | null;
}

export type SalesChannelDialogResult = SalesChannel | undefined;

/**
 * Create / edit a sales channel.
 *
 * <p>Two rules from the server are mirrored here so the user finds out while
 * they are looking at the form rather than on submit: a retail or marketplace
 * channel requires a house account (the receivable has to land on a real
 * account — never on the consumer), and channel type is immutable once the
 * channel exists (flipping a live channel would retroactively change what its
 * existing orders meant).</p>
 */
@Component({
  selector: 'app-sales-channel-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DialogComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './sales-channel-dialog.component.html',
  styleUrl: './sales-channel-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesChannelDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<SalesChannelDialogComponent, SalesChannelDialogResult>);
  private readonly data = inject<SalesChannelDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(SalesChannelService);
  private readonly customerService = inject(CustomerService);
  private readonly connectionService = inject(ECommerceConnectionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.channel;
  protected readonly saving = signal(false);
  protected readonly customerOptions = signal<SelectOption[]>([]);
  protected readonly connectionOptions = signal<SelectOption[]>([]);

  protected readonly form = this.fb.group({
    name: [this.data.channel?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    code: [
      { value: this.data.channel?.code ?? '', disabled: this.isEdit },
      [Validators.required, Validators.maxLength(40), Validators.pattern(/^[A-Z0-9][A-Z0-9-]*$/)],
    ],
    description: [this.data.channel?.description ?? '', Validators.maxLength(1000)],
    channelType: [
      { value: (this.data.channel?.channelType ?? 'DirectB2B') as SalesChannelType, disabled: this.isEdit },
      Validators.required,
    ],
    soldToCustomerId: [this.data.channel?.soldToCustomerId ?? null as number | null],
    taxCollectedBy: [(this.data.channel?.taxCollectedBy ?? null) as TaxCollectedBy | null],
    orderNumberPrefix: [this.data.channel?.orderNumberPrefix ?? '', Validators.maxLength(10)],
    eCommerceIntegrationId: [this.data.channel?.eCommerceIntegrationId ?? null as number | null],
  });

  /** Signal mirror of the type control, so the template can branch without calling a method. */
  private readonly channelType = signal<SalesChannelType>(
    (this.data.channel?.channelType ?? 'DirectB2B') as SalesChannelType,
  );

  protected readonly isRetail = computed(
    () => this.channelType() === 'DirectRetail' || this.channelType() === 'Marketplace',
  );

  protected readonly typeOptions: SelectOption[] = [
    { value: 'DirectB2B', label: this.translate.instant('salesChannels.type.DirectB2B') },
    { value: 'DirectRetail', label: this.translate.instant('salesChannels.type.DirectRetail') },
    { value: 'Marketplace', label: this.translate.instant('salesChannels.type.Marketplace') },
  ];

  protected readonly taxOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('salesChannels.taxDefault') },
    { value: 'Seller', label: this.translate.instant('salesChannels.taxSeller') },
    { value: 'Marketplace', label: this.translate.instant('salesChannels.taxMarketplace') },
  ];

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('salesChannels.fieldName'),
    code: this.translate.instant('salesChannels.fieldCode'),
    channelType: this.translate.instant('salesChannels.fieldType'),
    soldToCustomerId: this.translate.instant('salesChannels.fieldHouseAccount'),
  });

  protected readonly titleKey = this.isEdit ? 'salesChannels.editTitle' : 'salesChannels.createTitle';

  constructor() {
    this.customerService.getCustomers(undefined, true).subscribe({
      next: (customers) => {
        this.customerOptions.set([
          { value: null, label: this.translate.instant('salesChannels.noHouseAccountOption') },
          ...customers.map((c) => ({
            value: c.id,
            label: c.companyName ? `${c.name} (${c.companyName})` : c.name,
          })),
        ]);
      },
    });

    // Only offer connections whose platform actually has a connector. Attaching
    // one that cannot be polled turns the channel's Import action into a button
    // that reports success and does nothing.
    this.connectionService.getConnections().subscribe({
      next: (connections) => {
        this.connectionOptions.set([
          { value: null, label: this.translate.instant('salesChannels.noConnectionOption') },
          ...connections
            .filter((c) => c.isActive)
            .map((c) => ({ value: c.id, label: `${c.name} (${c.platform})` })),
        ]);
      },
    });

    // Keep the house-account requirement in step with the selected type. Applied
    // on every change rather than once at init because the user can flip the
    // type freely while creating.
    this.form.controls.channelType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.channelType.set((value ?? 'DirectB2B') as SalesChannelType);
        this.applyHouseAccountRequirement();
      });

    this.applyHouseAccountRequirement();
  }

  private applyHouseAccountRequirement(): void {
    const control = this.form.controls.soldToCustomerId;
    if (this.isRetail()) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    // getRawValue() rather than value — code and channelType are disabled on
    // edit and a plain read would drop them.
    const raw = this.form.getRawValue();
    const description = raw.description?.trim() ? raw.description.trim() : null;
    const prefix = raw.orderNumberPrefix?.trim() ? raw.orderNumberPrefix.trim().toUpperCase() : null;

    const existing = this.data.channel;
    const request$ = existing
      ? this.service.updateChannel(existing.id, {
          name: raw.name!.trim(),
          description,
          soldToCustomerId: raw.soldToCustomerId ?? null,
          taxCollectedBy: raw.taxCollectedBy ?? null,
          orderNumberPrefix: prefix,
          eCommerceIntegrationId: raw.eCommerceIntegrationId ?? null,
        })
      : this.service.createChannel({
          name: raw.name!.trim(),
          code: raw.code!.trim().toUpperCase(),
          description,
          channelType: raw.channelType as SalesChannelType,
          soldToCustomerId: raw.soldToCustomerId ?? null,
          taxCollectedBy: raw.taxCollectedBy ?? null,
          orderNumberPrefix: prefix,
          eCommerceIntegrationId: raw.eCommerceIntegrationId ?? null,
        });

    request$.subscribe({
      next: (channel) => {
        this.snackbar.success(
          this.translate.instant(existing ? 'salesChannels.updated' : 'salesChannels.created'),
        );
        this.dialogRef.close(channel);
      },
      error: () => this.saving.set(false),
    });
  }
}
