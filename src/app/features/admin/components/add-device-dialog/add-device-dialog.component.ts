import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { QrCodeComponent } from '../../../../shared/components/qr-code/qr-code.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AdminUser } from '../../models/admin-user.model';
import { AdminDevice, EnrollmentToken } from '../../models/device.model';
import { DeviceAdminService } from '../../services/device-admin.service';

/**
 * Admin "Add a device": mints a single-use enrollment token for the user and
 * renders it as a QR the phone scans on first run. Also lists the user's
 * enrolled devices with remote revoke.
 */
@Component({
  selector: 'app-admin-add-device-dialog',
  standalone: true,
  imports: [DatePipe, TranslatePipe, DialogComponent, QrCodeComponent],
  templateUrl: './add-device-dialog.component.html',
  styleUrl: './add-device-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddDeviceDialogComponent implements OnInit {
  private readonly deviceAdmin = inject(DeviceAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Null = enroll a shared device to the instance rather than to a person. */
  readonly user = input<AdminUser | null>(null);
  readonly closed = output<void>();

  protected readonly enrollment = signal<EnrollmentToken | null>(null);
  protected readonly issuing = signal(false);
  protected readonly devices = signal<AdminDevice[]>([]);
  protected readonly secondsLeft = signal(0);

  protected readonly qrPayload = computed(() => {
    const token = this.enrollment();
    if (!token) return '';
    return JSON.stringify({
      server: window.location.origin,
      token: token.token,
      name: token.instanceName,
      certSha256: token.certSha256,
      shared: token.isShared,
    });
  });

  protected readonly expired = computed(() => !!this.enrollment() && this.secondsLeft() <= 0);

  ngOnInit(): void {
    this.issueCode();
    this.loadDevices();

    const timer = setInterval(() => this.tick(), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected issueCode(): void {
    this.issuing.set(true);
    this.deviceAdmin.createEnrollmentToken(this.user()?.id ?? null).subscribe({
      next: (token) => {
        this.enrollment.set(token);
        this.issuing.set(false);
        this.tick();
      },
      error: (err: unknown) => {
        this.issuing.set(false);
        this.snackbar.errorFrom(err, 'admin.devices.issueFailed');
      },
    });
  }

  protected revoke(device: AdminDevice): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('admin.devices.revokeTitle'),
        message: this.translate.instant('admin.devices.revokeMessage', { name: device.name }),
        confirmLabel: this.translate.instant('admin.devices.revoke'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.deviceAdmin.revokeDevice(device.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.devices.revoked'));
          this.loadDevices();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'admin.devices.revokeFailed'),
      });
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  private loadDevices(): void {
    this.deviceAdmin.listDevices(this.user()?.id ?? undefined, !this.user()).subscribe({
      next: (devices) => this.devices.set(devices),
      error: () => this.devices.set([]),
    });
  }

  private tick(): void {
    const token = this.enrollment();
    if (!token) return;
    const remaining = Math.floor((new Date(token.expiresAt).getTime() - Date.now()) / 1000);
    this.secondsLeft.set(Math.max(0, remaining));
  }
}
