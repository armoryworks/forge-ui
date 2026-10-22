import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  PresetApplyDialogComponent,
  PresetApplyDialogData,
  PresetApplyDialogResult,
} from './preset-apply-dialog.component';
import { DialogEscapeService } from '../../services/dialog-escape.service';

function escapeStub(confirmed: boolean) {
  return {
    closeUnlessDirty: vi.fn((dirty: boolean, close: () => void) => {
      if (!dirty || confirmed) close();
    }),
  };
}

function setupDialog(data: PresetApplyDialogData, escape = escapeStub(false)) {
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<PresetApplyDialogComponent, PresetApplyDialogResult>;
  TestBed.configureTestingModule({
    imports: [PresetApplyDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: DialogEscapeService, useValue: escape },
    ],
  });
  const fixture = TestBed.createComponent(PresetApplyDialogComponent);
  fixture.detectChanges();
  return { fixture, dialogRef, escape };
}

describe('PresetApplyDialogComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders deltas grouped into enable / disable lists', () => {
    const { fixture } = setupDialog({
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      deltas: [
        { code: 'CAP-QC-INSPECTION', name: 'QC inspection', area: 'QC', currentlyEnabled: false, willBeEnabled: true },
        { code: 'CAP-ACCT-BUILTIN', name: 'Built-in accounting', area: 'ACCT', currentlyEnabled: true, willBeEnabled: false },
      ],
      violations: [],
    });
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Apply Production Manufacturer');
    expect(html).toContain('To enable (1)');
    expect(html).toContain('To disable (1)');
    expect(html).toContain('CAP-QC-INSPECTION');
    expect(html).toContain('CAP-ACCT-BUILTIN');
  });

  it('renders no-op state when deltas are empty', () => {
    const { fixture } = setupDialog({
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      deltas: [],
      violations: [],
      noOp: true,
    });
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Already at this preset');
  });

  it('disables confirm button when violations are present', () => {
    const { fixture } = setupDialog({
      presetId: 'PRESET-CUSTOM',
      presetName: 'Custom',
      isCustom: true,
      deltas: [
        { code: 'CAP-MD-PARTS', name: 'Parts', area: 'MD', currentlyEnabled: true, willBeEnabled: false },
      ],
      violations: [
        {
          code: 'capability-has-dependents',
          capability: 'CAP-MD-PARTS',
          message: "'CAP-MD-PARTS' is required by: CAP-MD-BOM",
          dependents: ['CAP-MD-BOM'],
        },
      ],
    });
    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="preset-apply-dialog-confirm"]',
    );
    expect(confirmBtn.disabled).toBe(true);
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Constraint violations (1)');
    expect(html).toContain('CAP-MD-PARTS');
  });

  it('returns confirmed=false on cancel', () => {
    const { fixture, dialogRef } = setupDialog({
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      deltas: [],
      violations: [],
      noOp: true,
    });
    const cancelBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="preset-apply-dialog-cancel"]',
    );
    cancelBtn.click();
    expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: false });
  });

  it('lets the admin re-apply a preset the install already matches', () => {
    const { fixture, dialogRef } = setupDialog({
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      deltas: [],
      violations: [],
      noOp: true,
    });
    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="preset-apply-dialog-confirm"]',
    );
    expect(confirmBtn.textContent).toContain('Re-apply');
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();
    expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true, reason: undefined });
  });

  it('returns confirmed=true with reason when confirm button clicked', () => {
    const { fixture, dialogRef } = setupDialog({
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      deltas: [
        { code: 'CAP-QC-INSPECTION', name: 'QC', area: 'QC', currentlyEnabled: false, willBeEnabled: true },
      ],
      violations: [],
    });
    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="preset-apply-dialog-confirm"]',
    );
    confirmBtn.click();
    expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true, reason: undefined });
  });

  describe('Escape', () => {
    const applyData: PresetApplyDialogData = {
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      deltas: [{ code: 'CAP-QC-INSPECTION', name: 'QC inspection', area: 'QC', currentlyEnabled: false, willBeEnabled: true }],
      violations: [],
    };

    function reasonControl(fixture: { componentInstance: PresetApplyDialogComponent }): { setValue(v: string): void } {
      return (fixture.componentInstance as unknown as { reasonControl: { setValue(v: string): void } }).reasonControl;
    }

    it('cancels straight away while no reason is typed', () => {
      const { fixture, dialogRef, escape } = setupDialog(applyData);

      fixture.componentInstance.onDialogEscape();

      expect(escape.closeUnlessDirty).toHaveBeenCalledWith(false, expect.any(Function));
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: false });
    });

    it('keeps a typed reason when the discard prompt is declined', () => {
      const { fixture, dialogRef, escape } = setupDialog(applyData);
      reasonControl(fixture).setValue('Quarterly review');

      fixture.componentInstance.onDialogEscape();

      expect(escape.closeUnlessDirty).toHaveBeenCalledWith(true, expect.any(Function));
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('cancels with a typed reason once the discard is confirmed', () => {
      const { fixture, dialogRef } = setupDialog(applyData, escapeStub(true));
      reasonControl(fixture).setValue('Quarterly review');

      fixture.componentInstance.onDialogEscape();

      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: false });
    });
  });
});
