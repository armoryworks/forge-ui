import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Observable } from 'rxjs';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AdminService } from '../services/admin.service';
import { ScanDeviceService } from '../services/scan-device.service';
import { ActiveUser } from '../models/active-user.model';
import { ScanDevice } from '../models/scan-device.model';
import { ScannerDialogComponent, ScannerDialogData, ScannerDialogResult } from './scanner-dialog.component';

/**
 * Admin > Scanners: the registry of paired barcode scanners, who each one is assigned to and when it last
 * scanned. Pairing is a record only; the scan endpoints do not require a paired device.
 */
@Component({
  selector: 'app-scanners-admin',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, SpacerDirective, DataTableComponent, ColumnCellDirective, LoadingBlockDirective, DateTimePipe],
  templateUrl: './scanners-admin.component.html',
  styleUrl: './scanners-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScannersAdminComponent {
  private readonly devicesService = inject(ScanDeviceService);
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly devices = signal<ScanDevice[]>([]);
  protected readonly users = signal<ActiveUser[]>([]);
  protected readonly loading = signal(true);

  protected readonly columns: ColumnDef[] = [
    { field: 'deviceName', header: this.translate.instant('admin.scanners.deviceName'), sortable: true },
    { field: 'deviceId', header: this.translate.instant('admin.scanners.deviceId'), sortable: true },
    { field: 'assignedUserName', header: this.translate.instant('admin.scanners.assignedUser'), sortable: true },
    { field: 'lastSeenAt', header: this.translate.instant('admin.scanners.lastSeen'), sortable: true, type: 'date', width: '160px' },
    { field: 'pairedAt', header: this.translate.instant('admin.scanners.pairedAt'), sortable: true, type: 'date', width: '160px' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
    { field: 'actions', header: '', width: '60px' },
  ];

  constructor() {
    this.load();
    this.admin.getActiveUsers().subscribe({ next: users => this.users.set(users) });
  }

  private load(): void {
    this.loading.set(true);
    this.devicesService.list().subscribe({
      next: devices => {
        this.devices.set(devices);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openPair(): void {
    this.openDialog({ users: this.users() }, result =>
      this.devicesService.pair({ deviceId: result.deviceId, deviceName: result.deviceName, assignedUserId: result.assignedUserId }));
  }

  protected openEdit(device: ScanDevice): void {
    this.openDialog({ device, users: this.users() }, result =>
      this.devicesService.update(device.id, { deviceName: result.deviceName, assignedUserId: result.assignedUserId, isActive: result.isActive }));
  }

  protected unpair(device: ScanDevice): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('admin.scanners.unpairTitle'),
        message: this.translate.instant('admin.scanners.unpairMessage', { name: device.deviceName ?? device.deviceId }),
        confirmLabel: this.translate.instant('admin.scanners.unpair'),
        severity: 'danger',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.devicesService.unpair(device.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.scanners.unpaired'));
          this.load();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'admin.scanners.saveFailed'),
      });
    });
  }

  private openDialog(data: ScannerDialogData, save: (result: ScannerDialogResult) => Observable<unknown>): void {
    this.dialog.open<ScannerDialogComponent, ScannerDialogData, ScannerDialogResult>(ScannerDialogComponent, { width: '480px', data })
      .afterClosed()
      .subscribe(result => {
        if (!result) return;
        save(result).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('admin.scanners.saved'));
            this.load();
          },
          error: (err: unknown) => this.snackbar.errorFrom(err, 'admin.scanners.saveFailed'),
        });
      });
  }
}
