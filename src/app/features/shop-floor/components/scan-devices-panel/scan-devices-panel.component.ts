import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanDevice } from '../../../../shared/models/scan-log.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-scan-devices-panel',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, InputComponent, EmptyStateComponent],
  templateUrl: './scan-devices-panel.component.html',
  styleUrl: './scan-devices-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanDevicesPanelComponent implements OnInit {
  private readonly scanActionService = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly devices = signal<ScanDevice[]>([]);
  readonly loading = signal(false);
  readonly showPairForm = signal(false);
  readonly pairing = signal(false);

  readonly deviceIdControl = new FormControl('', [Validators.required]);
  readonly deviceNameControl = new FormControl('');

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loading.set(true);
    this.scanActionService.getDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  togglePairForm(): void {
    this.showPairForm.update(v => !v);
    if (!this.showPairForm()) {
      this.deviceIdControl.reset();
      this.deviceNameControl.reset();
    }
  }

  pairDevice(): void {
    const deviceId = this.deviceIdControl.value?.trim();
    if (!deviceId) return;

    this.pairing.set(true);
    const deviceName = this.deviceNameControl.value?.trim() || undefined;

    this.scanActionService.pairDevice(deviceId, deviceName).subscribe({
      next: () => {
        this.pairing.set(false);
        this.showPairForm.set(false);
        this.deviceIdControl.reset();
        this.deviceNameControl.reset();
        this.snackbar.success('Device paired successfully');
        this.loadDevices();
      },
      error: () => {
        this.pairing.set(false);
        this.snackbar.error('Failed to pair device');
      },
    });
  }

  unpairDevice(device: ScanDevice): void {
    const displayName = device.deviceName || device.deviceId;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Unpair Device?',
        message: `This will remove "${displayName}" from paired devices.`,
        confirmLabel: 'Unpair',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.scanActionService.unpairDevice(device.id).subscribe({
        next: () => {
          this.snackbar.success(`Device "${displayName}" unpaired`);
          this.loadDevices();
        },
        error: () => {
          this.snackbar.error('Failed to unpair device');
        },
      });
    });
  }
}
