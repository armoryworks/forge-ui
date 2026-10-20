import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { UserIntegrationService } from '../../services/user-integration.service';
import { IntegrationProviderInfo } from '../../models/user-integration.model';

export interface ConnectIntegrationDialogData {
  provider: IntegrationProviderInfo;
}

@Component({
  selector: 'app-connect-integration-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DialogComponent,
    InputComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './connect-integration-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectIntegrationDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConnectIntegrationDialogComponent>);
  private readonly integrationService = inject(UserIntegrationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly data = inject<ConnectIntegrationDialogData>(MAT_DIALOG_DATA);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    displayName: new FormControl('', { nonNullable: true }),
    credentials: new FormControl('', { nonNullable: true }),
    username: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
    accessKey: new FormControl('', { nonNullable: true }),
    secretKey: new FormControl('', { nonNullable: true }),
    endpoint: new FormControl('', { nonNullable: true }),
    configJson: new FormControl('', { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    credentials: this.credentialLabel,
    username: this.translate.instant('account.integrationUsername'),
    password: this.translate.instant('account.integrationPassword'),
    accessKey: this.translate.instant('account.integrationAccessKey'),
    secretKey: this.translate.instant('account.integrationSecretKey'),
  });

  constructor() {
    const required = this.isSingleSecret
      ? [this.form.controls.credentials]
      : this.isBasic
        ? [this.form.controls.username, this.form.controls.password]
        : this.isAccessKey
          ? [this.form.controls.accessKey, this.form.controls.secretKey]
          : [];
    for (const control of required) {
      control.setValidators(Validators.required);
      control.updateValueAndValidity();
    }
  }

  protected get credentialLabel(): string {
    switch (this.data.provider.authType) {
      case 'webhook':
        return 'Webhook URL';
      case 'oauth2':
        return 'Access Token';
      case 'basic':
        return 'Credentials';
      case 'app_password':
        return 'App Password';
      case 'access_key':
        return 'Access Key';
      default:
        return 'Credentials';
    }
  }

  protected get credentialPlaceholder(): string {
    switch (this.data.provider.authType) {
      case 'webhook':
        return 'https://hooks.example.com/services/...';
      case 'oauth2':
        return 'Paste your access token here';
      case 'app_password':
        return 'App-specific password';
      case 'none':
        return 'No credentials required';
      default:
        return 'Enter credentials';
    }
  }

  protected get isSingleSecret(): boolean {
    const authType = this.data.provider.authType;
    return authType === 'webhook' || authType === 'oauth2' || authType === 'app_password';
  }

  protected get isBasic(): boolean {
    return this.data.provider.authType === 'basic';
  }

  protected get isAccessKey(): boolean {
    return this.data.provider.authType === 'access_key';
  }

  protected get isNoAuth(): boolean {
    return this.data.provider.authType === 'none';
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    const val = this.form.getRawValue();
    this.saving.set(true);

    // Build credentials JSON based on auth type
    let credentialsJson: string;
    if (this.data.provider.authType === 'webhook') {
      credentialsJson = JSON.stringify({ webhook_url: val.credentials });
    } else if (this.data.provider.authType === 'none') {
      credentialsJson = '{}';
    } else if (this.data.provider.authType === 'oauth2') {
      credentialsJson = JSON.stringify({ access_token: val.credentials });
    } else if (this.isBasic) {
      credentialsJson = JSON.stringify({ username: val.username, password: val.password });
    } else if (this.isAccessKey) {
      credentialsJson = JSON.stringify({
        accessKey: val.accessKey,
        secretKey: val.secretKey,
        ...(val.endpoint.trim() ? { endpoint: val.endpoint.trim() } : {}),
      });
    } else {
      // Try to parse as JSON; if not valid JSON, wrap in a simple object
      try {
        JSON.parse(val.credentials);
        credentialsJson = val.credentials;
      } catch {
        credentialsJson = JSON.stringify({ token: val.credentials });
      }
    }

    this.integrationService.create({
      category: this.data.provider.category,
      providerId: this.data.provider.providerId,
      displayName: val.displayName || null,
      credentialsJson,
      configJson: val.configJson || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('account.integrationConnected', { name: this.data.provider.displayName }));
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
