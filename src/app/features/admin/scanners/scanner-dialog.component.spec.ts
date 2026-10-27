import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';

import { ScanDevice } from '../models/scan-device.model';
import { ScannerDialogComponent, ScannerDialogData } from './scanner-dialog.component';

interface DialogInternals {
  form: { controls: Record<string, { value: unknown; disabled: boolean; setValue(v: unknown): void }>; invalid: boolean };
  userOptions: { value: unknown; label: string }[];
  save(): void;
}

const users = [{ id: 7, initials: 'WW', name: 'Worker, Will', color: '#888', canBeAssignedJobs: true }];

describe('ScannerDialogComponent', () => {
  const close = vi.fn();

  function build(data: ScannerDialogData): DialogInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    return TestBed.runInInjectionContext(() => new ScannerDialogComponent()) as unknown as DialogInternals;
  }

  beforeEach(() => close.mockReset());

  it('needs a scanned device id to pair and can assign a user', () => {
    const dialog = build({ users });

    expect(dialog.userOptions.map(o => o.value)).toEqual([null, 7]);
    expect(dialog.form.invalid).toBe(true);
    dialog.form.controls['deviceId'].setValue('  SN-42  ');
    dialog.form.controls['assignedUserId'].setValue(7);
    dialog.save();

    expect(close).toHaveBeenCalledWith({ deviceId: 'SN-42', deviceName: null, assignedUserId: 7, isActive: true });
  });

  it('keeps the device id fixed when editing and can unassign', () => {
    const device: ScanDevice = {
      id: 3, deviceId: 'SN-1', deviceName: 'Dock', pairedAt: '', isActive: true, assignedUserId: 7,
      assignedUserName: 'Worker, Will', pairedByName: null, lastSeenAt: null,
    };
    const dialog = build({ device, users });

    expect(dialog.form.controls['deviceId'].disabled).toBe(true);
    dialog.form.controls['assignedUserId'].setValue(null);
    dialog.form.controls['isActive'].setValue(false);
    dialog.save();

    expect(close).toHaveBeenCalledWith({ deviceId: 'SN-1', deviceName: 'Dock', assignedUserId: null, isActive: false });
  });
});
