import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { PartDetailDialogComponent } from './part-detail-dialog.component';

describe('PartDetailDialogComponent', () => {
  let keydown$: Subject<KeyboardEvent>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    keydown$ = new Subject<KeyboardEvent>();
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { keydownEvents: () => keydown$, close } },
        { provide: MAT_DIALOG_DATA, useValue: { partId: 7 } },
      ],
    });
    TestBed.runInInjectionContext(() => new PartDetailDialogComponent());
  });

  function escapeFrom(target: Element, prevented = false): void {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    if (prevented) event.preventDefault();
    target.dispatchEvent(event);
    keydown$.next(event);
  }

  it('closes on Escape', () => {
    escapeFrom(document.body);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    keydown$.next(new KeyboardEvent('keydown', { key: 'a' }));

    expect(close).not.toHaveBeenCalled();
  });

  it('leaves Escape to a field the user is typing in', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    escapeFrom(input);

    expect(close).not.toHaveBeenCalled();
    input.remove();
  });

  it('leaves Escape to a control that already handled it', () => {
    escapeFrom(document.body, true);

    expect(close).not.toHaveBeenCalled();
  });
});
