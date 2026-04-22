import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OidcAdminService } from '../../services/oidc-admin.service';
import { OidcMintTicketResponse } from '../../models/oidc-mint-ticket-response.model';

type ScopeOption = SelectOption;

const DEFAULT_SCOPES: ScopeOption[] = [
  { value: 'openid', label: 'openid' },
  { value: 'profile', label: 'profile' },
  { value: 'email', label: 'email' },
  { value: 'roles', label: 'roles' },
  { value: 'offline_access', label: 'offline_access' },
];

const DEFAULT_TTL_OPTIONS: SelectOption[] = [
  { value: 2, label: '2 hours' },
  { value: 24, label: '1 day' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
  { value: 336, label: '14 days' },
];

@Component({
  selector: 'app-oidc-mint-ticket-dialog',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './oidc-mint-ticket-dialog.component.html',
  styleUrl: './oidc-mint-ticket-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcMintTicketDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly oidc = inject(OidcAdminService);
  private readonly snackbar = inject(SnackbarService);

  readonly closed = output<void>();
  readonly minted = output<void>();

  protected readonly saving = signal(false);
  protected readonly result = signal<OidcMintTicketResponse | null>(null);

  protected readonly scopeOptions = DEFAULT_SCOPES;
  protected readonly ttlOptions = DEFAULT_TTL_OPTIONS;

  protected readonly form = new FormGroup({
    expectedClientName: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    allowedRedirectUriPrefix: new FormControl('', [
      Validators.required,
      Validators.maxLength(500),
      Validators.pattern(/^(https:\/\/|http:\/\/localhost).+/),
    ]),
    allowedPostLogoutRedirectUriPrefix: new FormControl(''),
    allowedScopes: new FormControl<string[]>(['openid', 'profile', 'email'], Validators.required),
    requiredRolesForUsersCsv: new FormControl(''),
    ttlHours: new FormControl<number>(72, [Validators.required, Validators.min(1), Validators.max(8760)]),
    requireSignedSoftwareStatement: new FormControl(false),
    trustedPublisherKeyIdsCsv: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    expectedClientName: 'Expected client name',
    allowedRedirectUriPrefix: 'Redirect URI prefix',
    allowedScopes: 'Allowed scopes',
    ttlHours: 'Ticket lifetime',
  });

  protected readonly canSubmit = computed(() => this.form.valid && !this.saving() && !this.result());

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const payload = {
      expectedClientName: f.expectedClientName!,
      allowedRedirectUriPrefix: f.allowedRedirectUriPrefix!,
      allowedPostLogoutRedirectUriPrefix: f.allowedPostLogoutRedirectUriPrefix || null,
      allowedScopes: f.allowedScopes ?? [],
      requiredRolesForUsers: csvToList(f.requiredRolesForUsersCsv),
      ttlHours: f.ttlHours ?? 72,
      requireSignedSoftwareStatement: f.requireSignedSoftwareStatement ?? false,
      trustedPublisherKeyIds: csvToList(f.trustedPublisherKeyIdsCsv),
      notes: f.notes || null,
    };

    this.oidc.mintTicket(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.result.set(res);
        this.snackbar.success('Ticket minted. Copy the one-time code below.');
        this.minted.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  protected copyTicket(): void {
    const t = this.result()?.rawTicket;
    if (!t) return;
    navigator.clipboard.writeText(t).then(
      () => this.snackbar.success('Ticket copied to clipboard.'),
      () => this.snackbar.error('Could not copy. Select and copy manually.'),
    );
  }

  protected finish(): void {
    this.dialogRef?.clearDraft?.();
    this.closed.emit();
  }
}

function csvToList(csv: string | null | undefined): string[] | null {
  if (!csv) return null;
  const list = csv.split(',').map(s => s.trim()).filter(s => s.length > 0);
  return list.length > 0 ? list : null;
}
