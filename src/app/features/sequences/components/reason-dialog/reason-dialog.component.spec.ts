import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ReasonDialogComponent, ReasonDialogData } from './reason-dialog.component';
import { DialogEscapeService } from '../../../../shared/services/dialog-escape.service';

function escapeStub(confirmed: boolean) {
  return {
    closeUnlessDirty: vi.fn((dirty: boolean, close: () => void) => {
      if (!dirty || confirmed) close();
    }),
  };
}

function setupDialog(data: ReasonDialogData, escape = escapeStub(false)) {
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<ReasonDialogComponent>;
  TestBed.configureTestingModule({
    imports: [ReasonDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: DialogEscapeService, useValue: escape },
    ],
  });
  const fixture = TestBed.createComponent(ReasonDialogComponent);
  fixture.detectChanges();
  return { fixture, dialogRef, escape };
}

function cancelButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement {
  return fixture.nativeElement.querySelector('[data-testid="sequence-reason-cancel"]') as HTMLButtonElement;
}

describe('ReasonDialogComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('labels the dismiss button with the caller-supplied cancel label', () => {
    const { fixture } = setupDialog({ title: 'Cancel this sequence?', confirmLabel: 'Cancel run', cancelLabel: 'Keep running' });
    expect(cancelButton(fixture).textContent?.trim()).toBe('Keep running');
  });

  it('falls back to the common cancel label when none is supplied', () => {
    const { fixture } = setupDialog({ title: 'Skip step?' });
    expect(cancelButton(fixture).textContent?.trim()).toBe('common.cancel');
  });

  it('closes with undefined when dismissed', () => {
    const { fixture, dialogRef } = setupDialog({ title: 'Skip step?', cancelLabel: 'Keep running' });
    cancelButton(fixture).click();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  describe('Escape', () => {
    function typeReason(fixture: { componentInstance: ReasonDialogComponent }, text: string): void {
      (fixture.componentInstance as unknown as { reason: { setValue(v: string): void } }).reason.setValue(text);
    }

    it('cancels straight away while no reason is typed', () => {
      const { fixture, dialogRef, escape } = setupDialog({ title: 'Skip step?' });

      fixture.componentInstance.onDialogEscape();

      expect(escape.closeUnlessDirty).toHaveBeenCalledWith(false, expect.any(Function));
      expect(dialogRef.close).toHaveBeenCalledWith(undefined);
    });

    it('keeps a typed reason when the discard prompt is declined', () => {
      const { fixture, dialogRef, escape } = setupDialog({ title: 'Skip step?' });
      typeReason(fixture, 'Tooling broke');

      fixture.componentInstance.onDialogEscape();

      expect(escape.closeUnlessDirty).toHaveBeenCalledWith(true, expect.any(Function));
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('cancels with a typed reason once the discard is confirmed', () => {
      const { fixture, dialogRef } = setupDialog({ title: 'Skip step?' }, escapeStub(true));
      typeReason(fixture, 'Tooling broke');

      fixture.componentInstance.onDialogEscape();

      expect(dialogRef.close).toHaveBeenCalledWith(undefined);
    });
  });
});
