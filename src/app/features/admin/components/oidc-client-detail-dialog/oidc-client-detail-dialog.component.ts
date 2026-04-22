import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OidcAdminService } from '../../services/oidc-admin.service';
import { OidcClientDetailResponse } from '../../models/oidc-client-detail-response.model';
import { OidcRotateSecretResponse } from '../../models/oidc-rotate-secret-response.model';

type ActivePanel = null | 'approve' | 'suspend' | 'edit' | 'rotated' | 'revoke';

@Component({
  selector: 'app-oidc-client-detail-dialog',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './oidc-client-detail-dialog.component.html',
  styleUrl: './oidc-client-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcClientDetailDialogComponent {
  private readonly oidc = inject(OidcAdminService);
  private readonly snackbar = inject(SnackbarService);

  readonly clientId = input.required<string>();
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly client = signal<OidcClientDetailResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly panel = signal<ActivePanel>(null);
  protected readonly rotatedSecret = signal<OidcRotateSecretResponse | null>(null);

  protected readonly approveForm = new FormGroup({
    isFirstParty: new FormControl(false),
    requireConsent: new FormControl(true),
    requiredRolesCsv: new FormControl(''),
    allowedCustomScopesCsv: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly suspendForm = new FormGroup({
    reason: new FormControl('', [Validators.required, Validators.maxLength(500)]),
  });

  protected readonly revokeForm = new FormGroup({
    reason: new FormControl('', [Validators.required, Validators.maxLength(500)]),
  });

  protected readonly editForm = new FormGroup({
    description: new FormControl(''),
    ownerEmail: new FormControl('', [Validators.email]),
    isFirstParty: new FormControl(false),
    requireConsent: new FormControl(true),
    requiredRolesCsv: new FormControl(''),
    allowedCustomScopesCsv: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly approveViolations = FormValidationService.getViolations(this.approveForm, {});
  protected readonly suspendViolations = FormValidationService.getViolations(this.suspendForm, { reason: 'Reason' });
  protected readonly revokeViolations = FormValidationService.getViolations(this.revokeForm, { reason: 'Reason' });
  protected readonly editViolations = FormValidationService.getViolations(this.editForm, { ownerEmail: 'Owner email' });

  protected readonly canApprove = computed(() => {
    const s = this.client()?.status;
    return s === 'Pending' || s === 'Suspended';
  });
  protected readonly canSuspend = computed(() => this.client()?.status === 'Active');
  protected readonly canRotate = computed(() => this.client()?.status === 'Active');
  protected readonly canEdit = computed(() => {
    const s = this.client()?.status;
    return s === 'Active' || s === 'Suspended';
  });
  protected readonly canRevoke = computed(() => {
    const s = this.client()?.status;
    return s !== undefined && s !== 'Revoked';
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    const id = this.clientId();
    if (!id) return;
    this.loading.set(true);
    this.oidc.getClient(id).subscribe({
      next: (c) => {
        this.client.set(c);
        this.editForm.patchValue({
          description: c.description ?? '',
          ownerEmail: c.ownerEmail ?? '',
          isFirstParty: c.isFirstParty,
          requireConsent: c.requireConsent,
          requiredRolesCsv: c.requiredRolesCsv ?? '',
          allowedCustomScopesCsv: c.allowedCustomScopesCsv ?? '',
          notes: c.notes ?? '',
        });
        this.approveForm.patchValue({
          isFirstParty: c.isFirstParty,
          requireConsent: c.requireConsent,
          requiredRolesCsv: c.requiredRolesCsv ?? '',
          allowedCustomScopesCsv: c.allowedCustomScopesCsv ?? '',
          notes: c.notes ?? '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openPanel(p: ActivePanel): void {
    this.panel.set(p);
  }

  protected closePanel(): void {
    this.panel.set(null);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected approve(): void {
    if (this.approveForm.invalid || this.saving()) return;
    const id = this.clientId();
    const v = this.approveForm.getRawValue();
    this.saving.set(true);
    this.oidc.approveClient(id, {
      isFirstParty: v.isFirstParty ?? false,
      requireConsent: v.requireConsent ?? true,
      requiredRolesCsv: v.requiredRolesCsv || null,
      allowedCustomScopesCsv: v.allowedCustomScopesCsv || null,
      notes: v.notes || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('Client approved.');
        this.panel.set(null);
        this.changed.emit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected suspend(): void {
    if (this.suspendForm.invalid || this.saving()) return;
    const id = this.clientId();
    const reason = this.suspendForm.getRawValue().reason!;
    this.saving.set(true);
    this.oidc.suspendClient(id, { reason }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('Client suspended.');
        this.panel.set(null);
        this.suspendForm.reset();
        this.changed.emit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected revoke(): void {
    if (this.revokeForm.invalid || this.saving()) return;
    const id = this.clientId();
    const reason = this.revokeForm.getRawValue().reason!;
    this.saving.set(true);
    this.oidc.revokeClient(id, reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('Client revoked.');
        this.panel.set(null);
        this.revokeForm.reset();
        this.changed.emit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected rotate(): void {
    if (this.saving()) return;
    const id = this.clientId();
    this.saving.set(true);
    this.oidc.rotateSecret(id).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.rotatedSecret.set(res);
        this.panel.set('rotated');
        this.snackbar.success('Secret rotated. Copy the new value now.');
        this.changed.emit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected saveEdit(): void {
    if (this.editForm.invalid || this.saving()) return;
    const id = this.clientId();
    const v = this.editForm.getRawValue();
    this.saving.set(true);
    this.oidc.updateClient(id, {
      description: v.description || null,
      ownerEmail: v.ownerEmail || null,
      isFirstParty: v.isFirstParty ?? false,
      requireConsent: v.requireConsent ?? true,
      requiredRolesCsv: v.requiredRolesCsv || null,
      allowedCustomScopesCsv: v.allowedCustomScopesCsv || null,
      notes: v.notes || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('Client updated.');
        this.panel.set(null);
        this.changed.emit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected copySecret(): void {
    const s = this.rotatedSecret()?.newClientSecret;
    if (!s) return;
    navigator.clipboard.writeText(s).then(
      () => this.snackbar.success('Secret copied to clipboard.'),
      () => this.snackbar.error('Could not copy. Select and copy manually.'),
    );
  }

  protected statusClass(status: string | undefined): string {
    switch (status) {
      case 'Active': return 'chip chip--success';
      case 'Pending': return 'chip chip--warning';
      case 'Suspended': return 'chip chip--info';
      case 'Revoked': return 'chip chip--error';
      default: return 'chip';
    }
  }
}
