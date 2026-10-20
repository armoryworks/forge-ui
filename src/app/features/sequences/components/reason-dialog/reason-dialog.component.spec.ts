import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ReasonDialogComponent, ReasonDialogData } from './reason-dialog.component';

function setupDialog(data: ReasonDialogData) {
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<ReasonDialogComponent>;
  TestBed.configureTestingModule({
    imports: [ReasonDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  const fixture = TestBed.createComponent(ReasonDialogComponent);
  fixture.detectChanges();
  return { fixture, dialogRef };
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
});
