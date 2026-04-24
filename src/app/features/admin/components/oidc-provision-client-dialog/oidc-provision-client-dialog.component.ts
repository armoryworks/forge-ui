import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OidcAdminService } from '../../services/oidc-admin.service';
import { OidcProvisionClientResponse } from '../../models/oidc-provision-client-response.model';
import { OidcIntegrationDetailsComponent } from '../oidc-integration-details/oidc-integration-details.component';

const DEFAULT_SCOPES: SelectOption[] = [
  { value: 'openid', label: 'openid' },
  { value: 'profile', label: 'profile' },
  { value: 'email', label: 'email' },
  { value: 'roles', label: 'roles' },
  { value: 'offline_access', label: 'offline_access' },
];

/**
 * Admin-driven direct client provisioning. Skips the RFC 7591 ticket / self-registration dance
 * for apps the admin owns themselves — the form POSTs straight to POST /api/v1/oidc/clients and
 * the inline response shows client_id / client_secret once plus the integration-details card
 * ready to paste into the external app.
 */
@Component({
  selector: 'app-oidc-provision-client-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    ValidationButtonComponent, OidcIntegrationDetailsComponent,
  ],
  templateUrl: './oidc-provision-client-dialog.component.html',
  styleUrl: './oidc-provision-client-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcProvisionClientDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly oidc = inject(OidcAdminService);
  private readonly snackbar = inject(SnackbarService);

  /** Passed in from the admin panel — configured public base URL so the integration card
   *  renders the correct issuer URL without hitting the API again. */
  readonly publicBaseUrl = input<string>('');

  readonly closed = output<void>();
  readonly provisioned = output<void>();

  protected readonly saving = signal(false);
  protected readonly result = signal<OidcProvisionClientResponse | null>(null);

  protected readonly scopeOptions = DEFAULT_SCOPES;

  protected readonly form = new FormGroup({
    clientName: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    redirectUrisText: new FormControl('', [Validators.required, redirectUriListValidator]),
    postLogoutRedirectUrisText: new FormControl(''),
    scopes: new FormControl<string[]>(['openid', 'profile', 'email'], Validators.required),
    approveImmediately: new FormControl(true),
    isFirstParty: new FormControl(true),
    requireConsent: new FormControl(false),
    requiredRolesCsv: new FormControl(''),
    ownerEmail: new FormControl('', [Validators.email]),
    description: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    clientName: 'Client name',
    redirectUrisText: 'Redirect URIs',
    scopes: 'Scopes',
    ownerEmail: 'Owner email',
  });

  protected readonly canSubmit = computed(() => this.violations().length === 0 && !this.saving() && !this.result());

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const payload = {
      clientName: f.clientName!.trim(),
      redirectUris: parseUriList(f.redirectUrisText!),
      postLogoutRedirectUris: parseUriList(f.postLogoutRedirectUrisText || ''),
      scopes: f.scopes ?? [],
      approveImmediately: f.approveImmediately ?? true,
      isFirstParty: f.isFirstParty ?? true,
      requireConsent: f.requireConsent ?? false,
      requiredRolesCsv: (f.requiredRolesCsv || '').trim() || undefined,
      ownerEmail: (f.ownerEmail || '').trim() || undefined,
      description: (f.description || '').trim() || undefined,
      notes: (f.notes || '').trim() || undefined,
    };

    this.oidc.provisionClient(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.result.set(res);
        this.snackbar.success('Client provisioned. Copy the secret now — it won\'t be shown again.');
        this.provisioned.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  protected finish(): void {
    this.dialogRef?.clearDraft?.();
    this.closed.emit();
  }
}

function parseUriList(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function redirectUriListValidator(control: AbstractControl): ValidationErrors | null {
  const raw = typeof control.value === 'string' ? control.value : '';
  const list = parseUriList(raw);
  if (list.length === 0) return { required: true };
  for (const u of list) {
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { invalidUri: u };
      if (parsed.hash) return { invalidUri: u };
    } catch {
      return { invalidUri: u };
    }
  }
  return null;
}
