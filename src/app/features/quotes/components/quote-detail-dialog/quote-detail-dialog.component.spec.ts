import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';

import { QuoteDetailDialogComponent } from './quote-detail-dialog.component';

interface DialogInternals {
  close(): void;
  onChanged(): void;
}

describe('QuoteDetailDialogComponent', () => {
  let dialog: DialogInternals;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { quoteId: 12 } },
      ],
    });
    dialog = TestBed.runInInjectionContext(() => new QuoteDetailDialogComponent()) as unknown as DialogInternals;
  });

  it('stays open when the quote changes and reports the change on close', () => {
    dialog.onChanged();

    expect(dialogRef.close).not.toHaveBeenCalled();

    dialog.close();

    expect(dialogRef.close).toHaveBeenCalledWith({ changed: true });
  });

  it('closes without a result when nothing changed', () => {
    dialog.close();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
