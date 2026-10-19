import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ScannerService } from '../../../../shared/services/scanner.service';

import { ScanLabelDialogComponent } from './scan-label-dialog.component';

interface DialogInternals {
  onScanned(code: string): void;
  close(): void;
}

function setup(scannerEnabled = true) {
  const close = vi.fn();
  const scanner = { enabled: vi.fn(() => scannerEnabled), disable: vi.fn(), enable: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { shipmentNumber: 'SH-0001' } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: ScannerService, useValue: scanner },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanLabelDialogComponent()) as unknown as DialogInternals;
  const destroy = () => TestBed.resetTestingModule();
  return { component, close, scanner, destroy };
}

describe('ScanLabelDialogComponent', () => {
  it('closes with the scanned code, trimmed', () => {
    const { component, close } = setup();

    component.onScanned('  v1.SH-0001.abc \n');

    expect(close).toHaveBeenCalledWith('v1.SH-0001.abc');
  });

  it('ignores a blank scan', () => {
    const { component, close } = setup();

    component.onScanned('   ');

    expect(close).not.toHaveBeenCalled();
  });

  it('closes with nothing when cancelled', () => {
    const { component, close } = setup();

    component.close();

    expect(close).toHaveBeenCalledWith(undefined);
  });

  it('pauses the page-wide scanner while open and resumes it when closed', () => {
    const { scanner, destroy } = setup(true);

    expect(scanner.disable).toHaveBeenCalled();
    expect(scanner.enable).not.toHaveBeenCalled();

    destroy();

    expect(scanner.enable).toHaveBeenCalledTimes(1);
  });

  it('leaves the scanner paused on close when it was already paused', () => {
    const { scanner, destroy } = setup(false);

    destroy();

    expect(scanner.enable).not.toHaveBeenCalled();
  });
});
