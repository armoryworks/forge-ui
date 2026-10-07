import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

function setupDialog(data: ConfirmDialogData) {
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<ConfirmDialogComponent>;
  TestBed.configureTestingModule({
    imports: [ConfirmDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDialogComponent);
  fixture.detectChanges();
  return { fixture, dialogRef };
}

describe('ConfirmDialogComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('lists the details under the message', () => {
    const { fixture } = setupDialog({
      title: 'Confirm Sales Order?',
      message: 'Confirm SO-1?',
      details: ['2 line(s) are priced at $0.00.', 'No ship-to address is set.'],
    });
    const items = fixture.nativeElement.querySelectorAll('[data-testid="confirm-dialog-details"] li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('2 line(s) are priced at $0.00.');
    expect(items[1].textContent).toContain('No ship-to address is set.');
  });

  it('renders no details list when there are none', () => {
    const { fixture } = setupDialog({ title: 'Delete?', message: 'Delete it?', details: [] });
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-dialog-details"]')).toBeNull();
  });

  it('closes with true on confirm', () => {
    const { fixture, dialogRef } = setupDialog({ title: 'Delete?', message: 'Delete it?' });
    fixture.componentInstance.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
