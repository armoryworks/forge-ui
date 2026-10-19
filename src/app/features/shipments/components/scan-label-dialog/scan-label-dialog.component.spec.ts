import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ScanLabelDialogComponent } from './scan-label-dialog.component';

interface DialogInternals {
  onScanned(code: string): void;
  close(): void;
}

function setup() {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { shipmentNumber: 'SH-0001' } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanLabelDialogComponent()) as unknown as DialogInternals;
  return { component, close };
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
});
