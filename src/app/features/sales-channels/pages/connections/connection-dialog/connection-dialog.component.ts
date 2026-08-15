import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { ECommerceConnectionService } from '../../../services/ecommerce-connection.service';
import {
  ECommerceConnection,
  ECommercePlatform,
  ECommercePlatformOption,
} from '../../../models/ecommerce-connection.model';

export interface ConnectionDialogData {
  /** Null creates; a connection edits it. */
  connection: ECommerceConnection | null;
  platforms: ECommercePlatformOption[];
}

export type ConnectionDialogResult = ECommerceConnection | undefined;

/**
 * Store credentials for one storefront or marketplace account.
 *
 * <p>Credentials are write-only: the API never returns the stored secret, so on
 * edit the field starts blank and staying blank means "leave it alone". Saying
 * that in the label matters — a blank secret field otherwise reads as "this
 * connection has no credentials".</p>
 *
 * <p>Only platforms with a registered connector can be picked. Accepting
 * credentials for one that cannot be polled would look like success and fail
 * silently on the first import.</p>
 */
@Component({
  selector: 'app-connection-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DialogComponent,
    InputComponent,
    SelectComponent,
    ToggleComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './connection-dialog.component.html',
  styleUrl: './connection-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ConnectionDialogComponent, ConnectionDialogResult>);
  private readonly data = inject<ConnectionDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(ECommerceConnectionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.connection;
  protected readonly saving = signal(false);

  private readonly supported = this.data.platforms.filter((p) => p.isSupported);

  protected readonly platformOptions: SelectOption[] = this.supported.map((p) => ({
    value: p.platform,
    label: p.name,
  }));

  protected readonly form = this.fb.group({
    name: [this.data.connection?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    platform: [
      {
        value: (this.data.connection?.platform ?? this.supported[0]?.platform ?? null) as ECommercePlatform | null,
        // Changing platform on a live connection would leave credentials shaped
        // for one API pointed at another. Replace the connection instead.
        disabled: this.isEdit,
      },
      Validators.required,
    ],
    credentials: [
      '',
      this.data.connection ? [Validators.maxLength(4000)] : [Validators.required, Validators.maxLength(4000)],
    ],
    storeUrl: [this.data.connection?.storeUrl ?? '', Validators.maxLength(500)],
    autoImportOrders: [this.data.connection?.autoImportOrders ?? true],
    syncInventory: [this.data.connection?.syncInventory ?? true],
    isActive: [this.data.connection?.isActive ?? true],
  });

  private readonly platform = signal<ECommercePlatform | null>(
    (this.data.connection?.platform ?? this.supported[0]?.platform ?? null) as ECommercePlatform | null,
  );

  /**
   * Per-platform guidance on what to paste. Generic "credentials" wording is how
   * people end up pasting the wrong one of a storefront's several secrets.
   */
  protected readonly credentialsHintKey = computed(() => {
    switch (this.platform()) {
      case 'Shopify':
        return 'connections.hintShopify';
      case 'WooCommerce':
        return 'connections.hintWooCommerce';
      default:
        return 'connections.hintGeneric';
    }
  });

  protected readonly storeUrlHintKey = computed(() =>
    this.platform() === 'Shopify' ? 'connections.hintShopifyUrl' : 'connections.hintStoreUrl',
  );

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('connections.fieldName'),
    platform: this.translate.instant('connections.fieldPlatform'),
    credentials: this.translate.instant('connections.fieldCredentials'),
  });

  protected readonly titleKey = this.isEdit ? 'connections.editTitle' : 'connections.createTitle';

  protected readonly credentialsLabelKey = this.isEdit
    ? 'connections.fieldCredentialsEdit'
    : 'connections.fieldCredentials';

  constructor() {
    this.form.controls.platform.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.platform.set(value));
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    // getRawValue() — platform is disabled on edit and a plain read would drop it.
    const raw = this.form.getRawValue();
    const storeUrl = raw.storeUrl?.trim() ? raw.storeUrl.trim() : null;
    const credentials = raw.credentials?.trim() ? raw.credentials.trim() : null;

    const existing = this.data.connection;
    const request$ = existing
      ? this.service.updateConnection(existing.id, {
          name: raw.name!.trim(),
          platform: raw.platform!,
          // Blank means unchanged. The API never hands the secret back, so there
          // is nothing to round-trip and no way to distinguish "same" from
          // "cleared" except by treating blank as leave-alone.
          credentials,
          storeUrl,
          isActive: !!raw.isActive,
          autoImportOrders: !!raw.autoImportOrders,
          syncInventory: !!raw.syncInventory,
        })
      : this.service.createConnection({
          name: raw.name!.trim(),
          platform: raw.platform!,
          credentials: credentials ?? '',
          storeUrl,
          autoImportOrders: !!raw.autoImportOrders,
          syncInventory: !!raw.syncInventory,
        });

    request$.subscribe({
      next: (connection) => {
        this.snackbar.success(
          this.translate.instant(existing ? 'connections.updated' : 'connections.created'),
        );
        this.dialogRef.close(connection);
      },
      error: () => this.saving.set(false),
    });
  }
}
