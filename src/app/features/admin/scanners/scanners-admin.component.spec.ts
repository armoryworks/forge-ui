import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AdminService } from '../services/admin.service';
import { ScanDeviceService } from '../services/scan-device.service';
import { ScanDevice } from '../models/scan-device.model';
import { ScannersAdminComponent } from './scanners-admin.component';

interface PageInternals {
  devices(): ScanDevice[];
  openPair(): void;
  openEdit(device: ScanDevice): void;
  unpair(device: ScanDevice): void;
}

const device: ScanDevice = {
  id: 3, deviceId: 'SN-1', deviceName: 'Dock', pairedAt: '2026-10-01T00:00:00Z', isActive: true,
  assignedUserId: null, assignedUserName: null, pairedByName: 'Admin, Ana', lastSeenAt: null,
};

describe('ScannersAdminComponent', () => {
  const service = { list: vi.fn(), pair: vi.fn(), update: vi.fn(), unpair: vi.fn() };
  const dialog = { open: vi.fn() };

  function build(): PageInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: ScanDeviceService, useValue: service },
        { provide: AdminService, useValue: { getActiveUsers: () => of([]) } },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new ScannersAdminComponent()) as unknown as PageInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    service.list.mockReturnValue(of([device]));
    service.pair.mockReturnValue(of(device));
    service.update.mockReturnValue(of(device));
    service.unpair.mockReturnValue(of(undefined));
  });

  it('lists the paired scanners', () => {
    expect(build().devices()).toEqual([device]);
  });

  it('pairs a scanner with the dialog result', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ deviceId: 'SN-2', deviceName: null, assignedUserId: 5, isActive: true }) });

    build().openPair();

    expect(service.pair).toHaveBeenCalledWith({ deviceId: 'SN-2', deviceName: null, assignedUserId: 5 });
  });

  it('assigns a scanner to a user through PUT', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ deviceId: 'SN-1', deviceName: 'Dock', assignedUserId: 9, isActive: true }) });

    build().openEdit(device);

    expect(service.update).toHaveBeenCalledWith(3, { deviceName: 'Dock', assignedUserId: 9, isActive: true });
  });

  it('unpairs only after confirmation', () => {
    const page = build();
    dialog.open.mockReturnValueOnce({ afterClosed: () => of(false) });
    page.unpair(device);
    expect(service.unpair).not.toHaveBeenCalled();

    dialog.open.mockReturnValueOnce({ afterClosed: () => of(true) });
    page.unpair(device);
    expect(service.unpair).toHaveBeenCalledWith(3);
  });
});
